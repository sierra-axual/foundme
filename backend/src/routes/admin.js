const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const UserManagementService = require('../services/userManagementService');
const { logger } = require('../config/database');

const router = express.Router();
const userManagementService = new UserManagementService();

// Initialize system roles and permissions
router.post('/initialize', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await userManagementService.initializeSystemRoles();
    
    res.json({
      success: true,
      message: 'System roles and permissions initialized successfully',
      data: result
    });
  } catch (error) {
    logger.error('Failed to initialize system roles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== USER MANAGEMENT =====

// Get all users with pagination and filtering
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { page, limit, role, is_active, search } = req.query;
    const filters = { role, is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined, search };
    const pagination = { page: parseInt(page) || 1, limit: parseInt(limit) || 20 };
    
    const result = await userManagementService.getUsers(filters, pagination);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to get users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user by ID
router.get('/users/:userId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await userManagementService.getUserById(userId);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Failed to get user:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Create new user
router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const userData = req.body;
    const user = await userManagementService.createUser(userData);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });
  } catch (error) {
    logger.error('Failed to create user:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update user
router.put('/users/:userId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    const user = await userManagementService.updateUser(userId, updateData);
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete user
router.delete('/users/:userId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    await userManagementService.deleteUser(userId);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete user:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ===== ROLE MANAGEMENT =====

// Get all roles
router.get('/roles', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const roles = await userManagementService.getRoles();
    
    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    logger.error('Failed to get roles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new role
router.post('/roles', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const roleData = req.body;
    const role = await userManagementService.createRole(roleData);
    
    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: role
    });
  } catch (error) {
    logger.error('Failed to create role:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update role
router.put('/roles/:roleId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { roleId } = req.params;
    const updateData = req.body;
    const role = await userManagementService.updateRole(roleId, updateData);
    
    res.json({
      success: true,
      message: 'Role updated successfully',
      data: role
    });
  } catch (error) {
    logger.error('Failed to update role:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete role
router.delete('/roles/:roleId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { roleId } = req.params;
    await userManagementService.deleteRole(roleId);
    
    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete role:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ===== PERMISSION MANAGEMENT =====

// Get all permissions
router.get('/permissions', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { category } = req.query;
    const permissions = await userManagementService.getPermissions(category);
    
    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    logger.error('Failed to get permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get permission categories
router.get('/permissions/categories', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const categories = await userManagementService.getPermissionCategories();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Failed to get permission categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== SYSTEM STATISTICS =====

// Get system statistics
router.get('/stats', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const stats = await userManagementService.getSystemStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get system stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== PERMISSION CHECKS =====

// Check if user has specific permission
router.get('/users/:userId/permissions/:permission', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { userId, permission } = req.params;
    const hasPermission = await userManagementService.userHasPermission(userId, permission);
    
    res.json({
      success: true,
      data: {
        userId,
        permission,
        hasPermission
      }
    });
  } catch (error) {
    logger.error('Failed to check user permission:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user permissions
router.get('/users/:userId/permissions', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const permissions = await userManagementService.getUserPermissions(userId);
    
    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    logger.error('Failed to get user permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
