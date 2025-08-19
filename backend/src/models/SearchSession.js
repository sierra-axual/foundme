const { postgresPool } = require('../config/database');

class SearchSession {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.session_name = data.session_name;
    this.search_type = data.search_type;
    this.status = data.status;
    this.created_at = data.created_at;
    this.started_at = data.started_at;
    this.completed_at = data.completed_at;
    this.total_results = data.total_results;
    this.error_message = data.error_message;
    this.metadata = data.metadata || {};
  }

  // Create a new search session
  static async create(sessionData) {
    const { user_id, session_name, search_type, metadata = {} } = sessionData;
    
    try {
      const query = `
        INSERT INTO search_sessions (user_id, session_name, search_type, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const result = await postgresPool.query(query, [user_id, session_name, search_type, metadata]);
      return new SearchSession(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create search session: ${error.message}`);
    }
  }

  // Find session by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM search_sessions WHERE id = $1';
      const result = await postgresPool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new SearchSession(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find search session: ${error.message}`);
    }
  }

  // Find sessions by user ID
  static async findByUserId(userId, limit = 50, offset = 0) {
    try {
      const query = `
        SELECT * FROM search_sessions 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await postgresPool.query(query, [userId, limit, offset]);
      return result.rows.map(row => new SearchSession(row));
    } catch (error) {
      throw new Error(`Failed to find user search sessions: ${error.message}`);
    }
  }

  // Find active sessions by user ID
  static async findActiveByUserId(userId) {
    try {
      const query = `
        SELECT * FROM search_sessions 
        WHERE user_id = $1 
        AND status IN ('pending', 'running')
        ORDER BY created_at DESC
      `;
      
      const result = await postgresPool.query(query, [userId]);
      return result.rows.map(row => new SearchSession(row));
    } catch (error) {
      throw new Error(`Failed to find active user sessions: ${error.message}`);
    }
  }

  // Update session status
  async updateStatus(status, additionalData = {}) {
    try {
      const updates = ['status = $1'];
      const values = [status];
      let paramCount = 2;

      if (status === 'running' && !this.started_at) {
        updates.push('started_at = CURRENT_TIMESTAMP');
      }

      if (status === 'completed' || status === 'failed') {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      }

      if (additionalData.total_results !== undefined) {
        updates.push(`total_results = $${paramCount}`);
        values.push(additionalData.total_results);
        paramCount++;
      }

      if (additionalData.error_message !== undefined) {
        updates.push(`error_message = $${paramCount}`);
        values.push(additionalData.error_message);
        paramCount++;
      }

      if (additionalData.metadata !== undefined) {
        updates.push(`metadata = $${paramCount}`);
        values.push(additionalData.metadata);
        paramCount++;
      }

      values.push(this.id);
      const query = `
        UPDATE search_sessions 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await postgresPool.query(query, values);
      Object.assign(this, result.rows[0]);
      
      return this;
    } catch (error) {
      throw new Error(`Failed to update session status: ${error.message}`);
    }
  }

  // Mark session as started
  async markStarted() {
    return this.updateStatus('running');
  }

  // Mark session as completed
  async markCompleted(totalResults = 0) {
    return this.updateStatus('completed', { total_results: totalResults });
  }

  // Mark session as failed
  async markFailed(errorMessage) {
    return this.updateStatus('failed', { error_message: errorMessage });
  }

  // Get session results count
  async getResultsCount() {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM osint_results 
        WHERE search_session_id = $1
      `;
      
      const result = await postgresPool.query(query, [this.id]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      throw new Error(`Failed to get results count: ${error.message}`);
    }
  }

  // Get session results
  async getResults(limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM osint_results 
        WHERE search_session_id = $1 
        ORDER BY discovered_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await postgresPool.query(query, [this.id, limit, offset]);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get session results: ${error.message}`);
    }
  }

  // Get session summary
  async getSummary() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_results,
          COUNT(CASE WHEN result_type = 'social_account' THEN 1 END) as social_accounts,
          COUNT(CASE WHEN result_type = 'breach' THEN 1 END) as breaches,
          COUNT(CASE WHEN result_type = 'metadata' THEN 1 END) as metadata_results,
          COUNT(CASE WHEN result_type = 'profile' THEN 1 END) as profile_results,
          AVG(confidence_score) as avg_confidence
        FROM osint_results 
        WHERE search_session_id = $1
      `;
      
      const result = await postgresPool.query(query, [this.id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get session summary: ${error.message}`);
    }
  }

  // Delete session and all related data
  async delete() {
    try {
      // Delete related OSINT results first
      await postgresPool.query('DELETE FROM osint_results WHERE search_session_id = $1', [this.id]);
      
      // Delete the session
      await postgresPool.query('DELETE FROM search_sessions WHERE id = $1', [this.id]);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete search session: ${error.message}`);
    }
  }

  // Get user's search statistics
  static async getUserStats(userId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_sessions,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running_sessions,
          AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
               THEN EXTRACT(EPOCH FROM (completed_at - started_at)) END) as avg_duration_seconds,
          SUM(total_results) as total_results_found
        FROM search_sessions 
        WHERE user_id = $1
      `;
      
      const result = await postgresPool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get user search stats: ${error.message}`);
    }
  }

  // Get platform-wide search statistics
  static async getPlatformStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_sessions,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running_sessions,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
               THEN EXTRACT(EPOCH FROM (completed_at - started_at)) END) as avg_duration_seconds,
          SUM(total_results) as total_results_found
        FROM search_sessions
      `;
      
      const result = await postgresPool.query(query);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get platform search stats: ${error.message}`);
    }
  }

  // Search sessions by criteria
  static async search(criteria, limit = 50, offset = 0) {
    try {
      const conditions = [];
      const values = [];
      let paramCount = 1;

      if (criteria.user_id) {
        conditions.push(`user_id = $${paramCount}`);
        values.push(criteria.user_id);
        paramCount++;
      }

      if (criteria.search_type) {
        conditions.push(`search_type = $${paramCount}`);
        values.push(criteria.search_type);
        paramCount++;
      }

      if (criteria.status) {
        conditions.push(`status = $${paramCount}`);
        values.push(criteria.status);
        paramCount++;
      }

      if (criteria.date_from) {
        conditions.push(`created_at >= $${paramCount}`);
        values.push(criteria.date_from);
        paramCount++;
      }

      if (criteria.date_to) {
        conditions.push(`created_at <= $${paramCount}`);
        values.push(criteria.date_to);
        paramCount++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      values.push(limit, offset);
      const query = `
        SELECT * FROM search_sessions 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;
      
      const result = await postgresPool.query(query, values);
      return result.rows.map(row => new SearchSession(row));
    } catch (error) {
      throw new Error(`Failed to search sessions: ${error.message}`);
    }
  }
}

module.exports = SearchSession;
