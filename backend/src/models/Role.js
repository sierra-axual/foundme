const { postgresPool } = require('../config/database');

class Role {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.permissions = data.permissions || [];
    this.is_system = data.is_system || false;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create a new role
  static async create(roleData) {
    const { name, description, permissions = [], is_system = false } = roleData;
    
    try {
      const query = `
        INSERT INTO roles (name, description, permissions, is_system)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const result = await postgresPool.query(query, [name, description, permissions, is_system]);
      return new Role(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create role: ${error.message}`);
    }
  }

  // Find role by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM roles WHERE id = $1';
      const result = await postgresPool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Role(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find role: ${error.message}`);
    }
  }

  // Find role by name
  static async findByName(name) {
    try {
      const query = 'SELECT * FROM roles WHERE name = $1';
      const result = await postgresPool.query(query, [name]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Role(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find role: ${error.message}`);
    }
  }

  // Get all roles
  static async findAll(includeSystem = true) {
    try {
      let query = 'SELECT * FROM roles';
      let params = [];
      
      if (!includeSystem) {
        query += ' WHERE is_system = false';
      }
      
      query += ' ORDER BY name';
      
      const result = await postgresPool.query(query, params);
      return result.rows.map(row => new Role(row));
    } catch (error) {
      throw new Error(`Failed to get roles: ${error.message}`);
    }
  }

  // Update role
  async update(updateData) {
    try {
      const allowedFields = ['name', 'description', 'permissions'];
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
        UPDATE roles 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await postgresPool.query(query, values);
      Object.assign(this, result.rows[0]);
      
      return this;
    } catch (error) {
      throw new Error(`Failed to update role: ${error.message}`);
    }
  }

  // Delete role
  async delete() {
    try {
      if (this.is_system) {
        throw new Error('Cannot delete system roles');
      }
      
      const query = 'DELETE FROM roles WHERE id = $1';
      await postgresPool.query(query, [this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete role: ${error.message}`);
    }
  }

  // Check if role has specific permission
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  // Add permission to role
  async addPermission(permission) {
    if (!this.permissions.includes(permission)) {
      this.permissions.push(permission);
      await this.update({ permissions: this.permissions });
    }
    return this;
  }

  // Remove permission from role
  async removePermission(permission) {
    this.permissions = this.permissions.filter(p => p !== permission);
    await this.update({ permissions: this.permissions });
    return this;
  }
}

module.exports = Role;
