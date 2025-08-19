const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const { logger, postgresPool } = require('../config/database');

class UserManagementService {
  constructor() {
    this.defaultPermissions = {
      admin: [
        'user:read', 'user:write', 'user:delete', 'user:manage',
        'role:read', 'role:write', 'role:delete', 'role:manage',
        'permission:read', 'permission:write', 'permission:delete', 'permission:manage',
        'osint:read', 'osint:write', 'osint:delete', 'osint:manage',
        'system:read', 'system:write', 'system:delete', 'system:manage'
      ],
      moderator: [
        'user:read', 'user:write',
        'osint:read', 'osint:write', 'osint:delete',
        'system:read'
      ],
      user: [
        'osint:read', 'osint:write'
      ]
    };
  }

  // Initialize system roles and permissions
  async initializeSystemRoles() {
    try {
      logger.info('Initializing system roles and permissions...');
      
      // Create system permissions
      const permissions = await this.createSystemPermissions();
      
      // Create system roles
      const roles = await this.createSystemRoles(permissions);
      
      logger.info('System roles and permissions initialized successfully');
      return { permissions, roles };
    } catch (error) {
      logger.error('Failed to initialize system roles:', error);
      throw error;
    }
  }

  // Create system permissions
  async createSystemPermissions() {
    const permissionData = [
      // User management permissions
      { name: 'user:read', description: 'Read user information', category: 'user_management' },
      { name: 'user:write', description: 'Create and update users', category: 'user_management' },
      { name: 'user:delete', description: 'Delete users', category: 'user_management' },
      { name: 'user:manage', description: 'Full user management', category: 'user_management' },
      
      // Role management permissions
      { name: 'role:read', description: 'Read role information', category: 'role_management' },
      { name: 'role:write', description: 'Create and update roles', category: 'role_management' },
      { name: 'role:delete', description: 'Delete roles', category: 'role_management' },
      { name: 'role:manage', description: 'Full role management', category: 'role_management' },
      
      // Permission management permissions
      { name: 'permission:read', description: 'Read permission information', category: 'permission_management' },
      { name: 'permission:write', description: 'Create and update permissions', category: 'permission_management' },
      { name: 'permission:delete', description: 'Delete permissions', category: 'permission_management' },
      { name: 'permission:manage', description: 'Full permission management', category: 'permission_management' },
      
      // OSINT permissions
      { name: 'osint:read', description: 'Read OSINT data', category: 'osint' },
      { name: 'osint:write', description: 'Create and update OSINT data', category: 'osint' },
      { name: 'osint:delete', description: 'Delete OSINT data', category: 'osint' },
      { name: 'osint:manage', description: 'Full OSINT management', category: 'osint' },
      
      // System permissions
      { name: 'system:read', description: 'Read system information', category: 'system' },
      { name: 'system:write', description: 'Update system settings', category: 'system' },
      { name: 'system:delete', description: 'Delete system data', category: 'system' },
      { name: 'system:manage', description: 'Full system management', category: 'system' }
    ];

    const createdPermissions = [];
    
    for (const permData of permissionData) {
      let permission = await Permission.findByName(permData.name);
      if (!permission) {
        permission = await Permission.create({ ...permData, is_system: true });
      }
      createdPermissions.push(permission);
    }
    
    return createdPermissions;
  }

  // Create system roles
  async createSystemRoles(permissions) {
    const roleData = [
      {
        name: 'admin',
        description: 'Full system administrator with all permissions',
        permissions: this.defaultPermissions.admin,
        is_system: true
      },
      {
        name: 'moderator',
        description: 'Moderator with limited administrative permissions',
        permissions: this.defaultPermissions.moderator,
        is_system: true
      },
      {
        name: 'user',
        description: 'Standard user with basic OSINT permissions',
        permissions: this.defaultPermissions.user,
        is_system: true
      }
    ];

    const createdRoles = [];
    
    for (const roleDataItem of roleData) {
      let role = await Role.findByName(roleDataItem.name);
      if (!role) {
        role = await Role.create(roleDataItem);
      }
      createdRoles.push(role);
    }
    
    return createdRoles;
  }

  // Get all users with pagination and filtering
  async getUsers(filters = {}, pagination = { page: 1, limit: 20 }) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 1;
      
      // Apply filters
      if (filters.role) {
        whereClause += ` AND role = $${paramCount}`;
        params.push(filters.role);
        paramCount++;
      }
      
      if (filters.is_active !== undefined) {
        whereClause += ` AND is_active = $${paramCount}`;
        params.push(filters.is_active);
        paramCount++;
      }
      
      if (filters.search) {
        whereClause += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
        paramCount++;
      }
      
      // Get total count
      const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
      const countResult = await postgresPool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);
      
      // Get users
      const usersQuery = `
        SELECT u.*, r.name as role_name, r.permissions as role_permissions
        FROM users u
        LEFT JOIN roles r ON u.role = r.name
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;
      
      params.push(limit, offset);
      const usersResult = await postgresPool.query(usersQuery, params);
      
      const users = usersResult.rows.map(row => ({
        ...row,
        role_permissions: row.role_permissions || []
      }));
      
      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get users:', error);
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  // Get user by ID with role and permissions
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get role information
      const role = await Role.findByName(user.role);
      if (role) {
        user.role_permissions = role.permissions;
        user.role_description = role.description;
      }
      
      return user;
    } catch (error) {
      logger.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  // Create new user
  async createUser(userData) {
    try {
      // Validate role exists
      if (userData.role) {
        const role = await Role.findByName(userData.role);
        if (!role) {
          throw new Error('Invalid role specified');
        }
      }
      
      // Create user
      const user = await User.create(userData);
      
      logger.info(`User created successfully: ${user.username}`);
      return user;
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  // Update user
  async updateUser(userId, updateData) {
    try {
      // Validate role exists if updating role
      if (updateData.role) {
        const role = await Role.findByName(updateData.role);
        if (!role) {
          throw new Error('Invalid role specified');
        }
      }
      
      // Update user
      const user = await User.update(userId, updateData);
      
      logger.info(`User updated successfully: ${user.username}`);
      return user;
    } catch (error) {
      logger.error('Failed to update user:', error);
      throw error;
    }
  }

  // Delete user
  async deleteUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.role === 'admin') {
        throw new Error('Cannot delete admin users');
      }
      
      await user.delete();
      
      logger.info(`User deleted successfully: ${user.username}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete user:', error);
      throw error;
    }
  }

  // Get all roles
  async getRoles() {
    try {
      const roles = await Role.findAll();
      return roles;
    } catch (error) {
      logger.error('Failed to get roles:', error);
      throw error;
    }
  }

  // Create new role
  async createRole(roleData) {
    try {
      const role = await Role.create(roleData);
      
      logger.info(`Role created successfully: ${role.name}`);
      return role;
    } catch (error) {
      logger.error('Failed to create role:', error);
      throw error;
    }
  }

  // Update role
  async updateRole(roleId, updateData) {
    try {
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('Role not found');
      }
      
      if (role.is_system) {
        throw new Error('Cannot modify system roles');
      }
      
      const updatedRole = await role.update(updateData);
      
      logger.info(`Role updated successfully: ${updatedRole.name}`);
      return updatedRole;
    } catch (error) {
      logger.error('Failed to update role:', error);
      throw error;
    }
  }

  // Delete role
  async deleteRole(roleId) {
    try {
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('Role not found');
      }
      
      if (role.is_system) {
        throw new Error('Cannot delete system roles');
      }
      
      // Check if any users are using this role
      const usersWithRole = await postgresPool.query(
        'SELECT COUNT(*) FROM users WHERE role = $1',
        [role.name]
      );
      
      if (parseInt(usersWithRole.rows[0].count) > 0) {
        throw new Error('Cannot delete role that is assigned to users');
      }
      
      await role.delete();
      
      logger.info(`Role deleted successfully: ${role.name}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete role:', error);
      throw error;
    }
  }

  // Get all permissions
  async getPermissions(category = null) {
    try {
      const permissions = await Permission.findAll(category);
      return permissions;
    } catch (error) {
      logger.error('Failed to get permissions:', error);
      throw error;
    }
  }

  // Get permission categories
  async getPermissionCategories() {
    try {
      const categories = await Permission.getCategories();
      return categories;
    } catch (error) {
      logger.error('Failed to get permission categories:', error);
      throw error;
    }
  }

  // Get system statistics
  async getSystemStats() {
    try {
      const stats = await User.getStats();
      
      // Get role statistics
      const roleStats = await postgresPool.query(`
        SELECT role, COUNT(*) as count
        FROM users
        GROUP BY role
        ORDER BY count DESC
      `);
      
      // Get permission statistics
      const permissionStats = await postgresPool.query(`
        SELECT category, COUNT(*) as count
        FROM permissions
        GROUP BY category
        ORDER BY count DESC
      `);
      
      return {
        ...stats,
        roles: roleStats.rows,
        permissions: permissionStats.rows
      };
    } catch (error) {
      logger.error('Failed to get system stats:', error);
      throw error;
    }
  }

  // Check if user has permission
  async userHasPermission(userId, permission) {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return false;
      }
      
      const role = await Role.findByName(user.role);
      if (!role) {
        return false;
      }
      
      return role.hasPermission(permission);
    } catch (error) {
      logger.error('Failed to check user permission:', error);
      return false;
    }
  }

  // Get user permissions
  async getUserPermissions(userId) {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const role = await Role.findByName(user.role);
      if (!role) {
        return [];
      }
      
      return role.permissions;
    } catch (error) {
      logger.error('Failed to get user permissions:', error);
      throw error;
    }
  }
}

module.exports = UserManagementService;
