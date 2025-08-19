const { postgresPool } = require('../config/database');
const bcrypt = require('bcrypt');

class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.password_hash = data.password_hash;
    this.is_active = data.is_active;
    this.role = data.role;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.last_login = data.last_login;
    this.search_quota_daily = data.search_quota_daily;
    this.search_quota_monthly = data.search_quota_monthly;
  }

  // Create a new user
  static async create(userData) {
    const { username, email, password, password_hash, role = 'user' } = userData;
    
    try {
      let finalPasswordHash;
      
      if (password_hash) {
        // Use provided password hash
        finalPasswordHash = password_hash;
      } else if (password) {
        // Hash the password
        const saltRounds = 12;
        finalPasswordHash = await bcrypt.hash(password, saltRounds);
      } else {
        throw new Error('Either password or password_hash must be provided');
      }
      
      const query = `
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const result = await postgresPool.query(query, [username, email, finalPasswordHash, role]);
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = $1';
      const result = await postgresPool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find user: ${error.message}`);
    }
  }

  // Find user by username
  static async findByUsername(username) {
    try {
      const query = 'SELECT * FROM users WHERE username = $1';
      const result = await postgresPool.query(query, [username]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find user: ${error.message}`);
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await postgresPool.query(query, [email]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return null;
    } catch (error) {
      throw new Error(`Failed to find user: ${error.message}`);
    }
  }

  // Update user
  async update(updateData) {
    try {
      const allowedFields = ['username', 'email', 'is_active', 'role', 'search_quota_daily', 'search_quota_monthly'];
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
        UPDATE users 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await postgresPool.query(query, values);
      Object.assign(this, result.rows[0]);
      
      return this;
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  // Update password
  async updatePassword(newPassword) {
    try {
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(newPassword, saltRounds);
      
      const query = `
        UPDATE users 
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await postgresPool.query(query, [password_hash, this.id]);
      this.password_hash = result.rows[0].password_hash;
      this.updated_at = result.rows[0].updated_at;
      
      return this;
    } catch (error) {
      throw new Error(`Failed to update password: ${error.message}`);
    }
  }

  // Update last login
  async updateLastLogin() {
    try {
      const query = `
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await postgresPool.query(query, [this.id]);
      this.last_login = result.rows[0].last_login;
      
      return this;
    } catch (error) {
      throw new Error(`Failed to update last login: ${error.message}`);
    }
  }

  // Verify password
  async verifyPassword(password) {
    try {
      return await bcrypt.compare(password, this.password_hash);
    } catch (error) {
      throw new Error(`Failed to verify password: ${error.message}`);
    }
  }

  // Check if user has search quota remaining
  async hasSearchQuota() {
    try {
      // Check daily quota
      const dailyQuery = `
        SELECT COUNT(*) as daily_count
        FROM search_history 
        WHERE user_id = $1 
        AND created_at >= CURRENT_DATE
      `;
      
      const monthlyQuery = `
        SELECT COUNT(*) as monthly_count
        FROM search_history 
        WHERE user_id = $1 
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      `;
      
      const [dailyResult, monthlyResult] = await Promise.all([
        postgresPool.query(dailyQuery, [this.id]),
        postgresPool.query(monthlyQuery, [this.id])
      ]);
      
      const dailyCount = parseInt(dailyResult.rows[0].daily_count);
      const monthlyCount = parseInt(monthlyResult.rows[0].monthly_count);
      
      return {
        daily: {
          used: dailyCount,
          limit: this.search_quota_daily,
          remaining: Math.max(0, this.search_quota_daily - dailyCount)
        },
        monthly: {
          used: monthlyCount,
          limit: this.search_quota_monthly,
          remaining: Math.max(0, this.search_quota_monthly - monthlyCount)
        },
        canSearch: dailyCount < this.search_quota_daily && monthlyCount < this.search_quota_monthly
      };
    } catch (error) {
      throw new Error(`Failed to check search quota: ${error.message}`);
    }
  }

  // Delete user
  async delete() {
    try {
      const query = 'DELETE FROM users WHERE id = $1';
      await postgresPool.query(query, [this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  // Get all users (admin only)
  static async findAll(limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM users 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      
      const result = await postgresPool.query(query, [limit, offset]);
      return result.rows.map(row => new User(row));
    } catch (error) {
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  // Get user statistics
  static async getStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
          AVG(search_quota_daily) as avg_daily_quota,
          AVG(search_quota_monthly) as avg_monthly_quota
        FROM users
      `;
      
      const result = await postgresPool.query(query);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get user stats: ${error.message}`);
    }
  }

  // Static method to update user password
  static async updatePassword(userId, passwordHash) {
    try {
      const query = `
        UPDATE users 
        SET password_hash = $1, updated_at = NOW() 
        WHERE id = $2
        RETURNING id, username, email, role, updated_at
      `;
      
      const result = await postgresPool.query(query, [passwordHash, userId]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update user password: ${error.message}`);
    }
  }

  // Static method to update last login
  static async updateLastLogin(userId) {
    try {
      const query = `
        UPDATE users 
        SET last_login = NOW(), updated_at = NOW() 
        WHERE id = $1
        RETURNING id, username, email, role, last_login, updated_at
      `;
      
      const result = await postgresPool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update user last login: ${error.message}`);
    }
  }

  // Static method to update user fields
  static async update(userId, updateData) {
    try {
      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      
      if (fields.length === 0) {
        throw new Error('No fields to update');
      }
      
      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const query = `
        UPDATE users 
        SET ${setClause}, updated_at = NOW() 
        WHERE id = $1
        RETURNING id, username, email, role, is_active, created_at, updated_at
      `;
      
      const result = await postgresPool.query(query, [userId, ...values]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }
}

module.exports = User;
