const { postgresPool } = require('../config/database');

class OSINTResult {
  constructor(data) {
    this.id = data.id;
    this.search_session_id = data.search_session_id;
    this.target_identifier = data.target_identifier;
    this.target_type = data.target_type;
    this.tool_name = data.tool_name;
    this.result_type = data.result_type;
    this.result_data = data.result_data || {};
    this.confidence_score = data.confidence_score || 0.0;
    this.source_url = data.source_url;
    this.discovered_at = data.discovered_at;
    this.is_verified = data.is_verified || false;
    this.tags = data.tags || [];
  }

  // Create a new OSINT result
  static async create(resultData) {
    const {
      search_session_id,
      target_identifier,
      target_type,
      tool_name,
      result_type,
      result_data,
      confidence_score = 0.0,
      source_url,
      tags = []
    } = resultData;
    
    try {
      const query = `
        INSERT INTO osint_results (
          search_session_id, target_identifier, target_type, tool_name, 
          result_type, result_data, confidence_score, source_url, tags
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const result = await postgresPool.query(query, [
        search_session_id, target_identifier, target_type, tool_name,
        result_type, result_data, confidence_score, source_url, tags
      ]);
      
      return new OSINTResult(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create OSINT result: ${error.message}`);
    }
  }

  // Create multiple OSINT results in batch
  static async createBatch(resultsData) {
    if (!Array.isArray(resultsData) || resultsData.length === 0) {
      throw new Error('Results data must be a non-empty array');
    }

    try {
      const client = await postgresPool.connect();
      
      try {
        await client.query('BEGIN');
        
        const createdResults = [];
        
        for (const resultData of resultsData) {
          const result = await OSINTResult.create(resultData);
          createdResults.push(result);
        }
        
        await client.query('COMMIT');
        return createdResults;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      throw new Error(`Failed to create batch OSINT results: ${error.message}`);
    }
  }

  // Find result by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM osint_results WHERE id = $1';
      const result = await postgresPool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new OSINTResult(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find OSINT result: ${error.message}`);
    }
  }

  // Find results by search session ID
  static async findBySearchSessionId(searchSessionId, limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM osint_results 
        WHERE search_session_id = $1 
        ORDER BY discovered_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await postgresPool.query(query, [searchSessionId, limit, offset]);
      return result.rows.map(row => new OSINTResult(row));
    } catch (error) {
      throw new Error(`Failed to find session results: ${error.message}`);
    }
  }

  // Find results by target identifier
  static async findByTargetIdentifier(identifier, targetType = null, limit = 100, offset = 0) {
    try {
      let query = `
        SELECT * FROM osint_results 
        WHERE target_identifier = $1
      `;
      const values = [identifier];
      let paramCount = 2;

      if (targetType) {
        query += ` AND target_type = $${paramCount}`;
        values.push(targetType);
        paramCount++;
      }

      query += ` ORDER BY discovered_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      values.push(limit, offset);
      
      const result = await postgresPool.query(query, values);
      return result.rows.map(row => new OSINTResult(row));
    } catch (error) {
      throw new Error(`Failed to find target results: ${error.message}`);
    }
  }

  // Find results by tool name
  static async findByToolName(toolName, limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM osint_results 
        WHERE tool_name = $1 
        ORDER BY discovered_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await postgresPool.query(query, [toolName, limit, offset]);
      return result.rows.map(row => new OSINTResult(row));
    } catch (error) {
      throw new Error(`Failed to find tool results: ${error.message}`);
    }
  }

  // Find results by result type
  static async findByResultType(resultType, limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM osint_results 
        WHERE result_type = $1 
        ORDER BY discovered_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await postgresPool.query(query, [resultType, limit, offset]);
      return result.rows.map(row => new OSINTResult(row));
    } catch (error) {
      throw new Error(`Failed to find result type results: ${error.message}`);
    }
  }

  // Update result
  async update(updateData) {
    try {
      const allowedFields = [
        'result_data', 'confidence_score', 'source_url', 
        'is_verified', 'tags'
      ];
      
      const updates = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(this.id);
      const query = `
        UPDATE osint_results 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await postgresPool.query(query, values);
      Object.assign(this, result.rows[0]);
      
      return this;
    } catch (error) {
      throw new Error(`Failed to update OSINT result: ${error.message}`);
    }
  }

  // Update confidence score
  async updateConfidenceScore(score) {
    if (score < 0 || score > 1) {
      throw new Error('Confidence score must be between 0 and 1');
    }
    
    return this.update({ confidence_score: score });
  }

  // Mark as verified
  async markVerified() {
    return this.update({ is_verified: true });
  }

  // Mark as unverified
  async markUnverified() {
    return this.update({ is_verified: false });
  }

  // Add tags
  async addTags(newTags) {
    if (!Array.isArray(newTags)) {
      newTags = [newTags];
    }
    
    const updatedTags = [...new Set([...this.tags, ...newTags])];
    return this.update({ tags: updatedTags });
  }

  // Remove tags
  async removeTags(tagsToRemove) {
    if (!Array.isArray(tagsToRemove)) {
      tagsToRemove = [tagsToRemove];
    }
    
    const updatedTags = this.tags.filter(tag => !tagsToRemove.includes(tag));
    return this.update({ tags: updatedTags });
  }

  // Get related social accounts
  async getSocialAccounts() {
    try {
      const query = `
        SELECT * FROM social_accounts 
        WHERE osint_result_id = $1
        ORDER BY platform, username
      `;
      
      const result = await postgresPool.query(query, [this.id]);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get social accounts: ${error.message}`);
    }
  }

  // Get related data breaches
  async getDataBreaches() {
    try {
      const query = `
        SELECT * FROM data_breaches 
        WHERE osint_result_id = $1
        ORDER BY breach_date DESC
      `;
      
      const result = await postgresPool.query(query, [this.id]);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get data breaches: ${error.message}`);
    }
  }

  // Delete result and related data
  async delete() {
    try {
      // Delete related social accounts
      await postgresPool.query('DELETE FROM social_accounts WHERE osint_result_id = $1', [this.id]);
      
      // Delete related data breaches
      await postgresPool.query('DELETE FROM data_breaches WHERE osint_result_id = $1', [this.id]);
      
      // Delete the result
      await postgresPool.query('DELETE FROM osint_results WHERE id = $1', [this.id]);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete OSINT result: ${error.message}`);
    }
  }

  // Search results by criteria
  static async search(criteria, limit = 100, offset = 0) {
    try {
      const conditions = [];
      const values = [];
      let paramCount = 1;

      if (criteria.search_session_id) {
        conditions.push(`search_session_id = $${paramCount}`);
        values.push(criteria.search_session_id);
        paramCount++;
      }

      if (criteria.target_identifier) {
        conditions.push(`target_identifier ILIKE $${paramCount}`);
        values.push(`%${criteria.target_identifier}%`);
        paramCount++;
      }

      if (criteria.target_type) {
        conditions.push(`target_type = $${paramCount}`);
        values.push(criteria.target_type);
        paramCount++;
      }

      if (criteria.tool_name) {
        conditions.push(`tool_name = $${paramCount}`);
        values.push(criteria.tool_name);
        paramCount++;
      }

      if (criteria.result_type) {
        conditions.push(`result_type = $${paramCount}`);
        values.push(criteria.result_type);
        paramCount++;
      }

      if (criteria.min_confidence !== undefined) {
        conditions.push(`confidence_score >= $${paramCount}`);
        values.push(criteria.min_confidence);
        paramCount++;
      }

      if (criteria.max_confidence !== undefined) {
        conditions.push(`confidence_score <= $${paramCount}`);
        values.push(criteria.max_confidence);
        paramCount++;
      }

      if (criteria.is_verified !== undefined) {
        conditions.push(`is_verified = $${paramCount}`);
        values.push(criteria.is_verified);
        paramCount++;
      }

      if (criteria.tags && criteria.tags.length > 0) {
        conditions.push(`tags && $${paramCount}`);
        values.push(criteria.tags);
        paramCount++;
      }

      if (criteria.date_from) {
        conditions.push(`discovered_at >= $${paramCount}`);
        values.push(criteria.date_from);
        paramCount++;
      }

      if (criteria.date_to) {
        conditions.push(`discovered_at <= $${paramCount}`);
        values.push(criteria.date_to);
        paramCount++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      values.push(limit, offset);
      const query = `
        SELECT * FROM osint_results 
        ${whereClause}
        ORDER BY discovered_at DESC 
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;
      
      const result = await postgresPool.query(query, values);
      return result.rows.map(row => new OSINTResult(row));
    } catch (error) {
      throw new Error(`Failed to search OSINT results: ${error.message}`);
    }
  }

  // Get result statistics
  static async getStats(criteria = {}) {
    try {
      let conditions = [];
      const values = [];
      let paramCount = 1;

      if (criteria.search_session_id) {
        conditions.push(`search_session_id = $${paramCount}`);
        values.push(criteria.search_session_id);
        paramCount++;
      }

      if (criteria.target_type) {
        conditions.push(`target_type = $${paramCount}`);
        values.push(criteria.target_type);
        paramCount++;
      }

      if (criteria.tool_name) {
        conditions.push(`tool_name = $${paramCount}`);
        values.push(criteria.tool_name);
        paramCount++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      const query = `
        SELECT 
          COUNT(*) as total_results,
          COUNT(CASE WHEN result_type = 'social_account' THEN 1 END) as social_accounts,
          COUNT(CASE WHEN result_type = 'breach' THEN 1 END) as breaches,
          COUNT(CASE WHEN result_type = 'metadata' THEN 1 END) as metadata_results,
          COUNT(CASE WHEN result_type = 'profile' THEN 1 END) as profile_results,
          COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_results,
          AVG(confidence_score) as avg_confidence,
          MIN(confidence_score) as min_confidence,
          MAX(confidence_score) as max_confidence
        FROM osint_results 
        ${whereClause}
      `;
      
      const result = await postgresPool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get result stats: ${error.message}`);
    }
  }

  // Get unique target identifiers
  static async getUniqueTargets(targetType = null, limit = 100) {
    try {
      let query = `
        SELECT DISTINCT target_identifier, target_type, COUNT(*) as result_count
        FROM osint_results
      `;
      const values = [];

      if (targetType) {
        query += ` WHERE target_type = $1`;
        values.push(targetType);
      }

      query += ` GROUP BY target_identifier, target_type ORDER BY result_count DESC LIMIT $${values.length + 1}`;
      values.push(limit);
      
      const result = await postgresPool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get unique targets: ${error.message}`);
    }
  }
}

module.exports = OSINTResult;
