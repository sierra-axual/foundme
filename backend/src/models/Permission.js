const { postgresPool } = require('../config/database');

class Permission {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.category = data.category;
    this.is_system = data.is_system || false;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create a new permission
  static async create(permissionData) {
    const { name, description, category, is_system = false } = permissionData;
    
    try {
      const query = `
        INSERT INTO permissions (name, description, category, is_system)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const result = await postgresPool.query(query, [name, description, category, is_system]);
      return new Permission(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create permission: ${error.message}`);
    }
  }

  // Find permission by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM permissions WHERE id = $1';
      const result = await postgresPool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Permission(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find permission: ${error.message}`);
    }
  }

  // Find permission by name
  static async findByName(name) {
    try {
      const query = 'SELECT * FROM permissions WHERE name = $1';
      const result = await postgresPool.query(query, [name]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Permission(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find permission: ${error.message}`);
    }
  }

  // Get all permissions
  static async findAll(category = null) {
    try {
      let query = 'SELECT * FROM permissions';
      let params = [];
      
      if (category) {
        query += ' WHERE category = $1';
        params.push(category);
      }
      
      query += ' ORDER BY category, name';
      
      const result = await postgresPool.query(query, params);
      return result.rows.map(row => new Permission(row));
    } catch (error) {
      throw new Error(`Failed to get permissions: ${error.message}`);
    }
  }

  // Get permissions by category
  static async findByCategory(category) {
    try {
      const query = 'SELECT * FROM permissions WHERE category = $1 ORDER BY name';
      const result = await postgresPool.query(query, [category]);
      return result.rows.map(row => new Permission(row));
    } catch (error) {
      throw new Error(`Failed to get permissions by category: ${error.message}`);
    }
  }

  // Update permission
  async update(updateData) {
    try {
      const allowedFields = ['name', 'description', 'category'];
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
        UPDATE permissions 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await postgresPool.query(query, values);
      Object.assign(this, result.rows[0]);
      
      return this;
    } catch (error) {
      throw new Error(`Failed to update permission: ${error.message}`);
    }
  }

  // Delete permission
  async delete() {
    try {
      if (this.is_system) {
        throw new Error('Cannot delete system permissions');
      }
      
      const query = 'DELETE FROM permissions WHERE id = $1';
      await postgresPool.query(query, [this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete permission: ${error.message}`);
    }
  }

  // Get permission categories
  static async getCategories() {
    try {
      const query = 'SELECT DISTINCT category FROM permissions ORDER BY category';
      const result = await postgresPool.query(query);
      return result.rows.map(row => row.category);
    } catch (error) {
      throw new Error(`Failed to get permission categories: ${error.message}`);
    }
  }
}

module.exports = Permission;
