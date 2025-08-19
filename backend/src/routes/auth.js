const express = require('express');
const { logger } = require('../config/database');
const AuthService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const authService = new AuthService();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role specified'
      });
    }

    const result = await authService.registerUser({
      username,
      email,
      password,
      role
    });

    res.status(201).json(result);

  } catch (error) {
    logger.error('User registration failed:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT tokens
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username/email and password are required'
      });
    }

    const result = await authService.loginUser({ username, password });

    res.json(result);

  } catch (error) {
    logger.error('User login failed:', error);
    
    if (error.message.includes('Invalid credentials') || 
        error.message.includes('Account is deactivated')) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.json(result);

  } catch (error) {
    logger.error('Token refresh failed:', error);
    
    if (error.message.includes('Invalid refresh token') ||
        error.message.includes('User not found')) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Token refresh failed. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password (requires authentication)
 * @access  Private
 */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Basic validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long'
      });
    }

    const result = await authService.changePassword(userId, {
      currentPassword,
      newPassword
    });

    res.json(result);

  } catch (error) {
    logger.error('Password change failed:', error);
    
    if (error.message.includes('Current password is incorrect')) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('User not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Password change failed. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/request-reset
 * @desc    Request password reset
 * @access  Public
 */
router.post('/request-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await authService.requestPasswordReset(email);

    res.json(result);

  } catch (error) {
    logger.error('Password reset request failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Password reset request failed. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with reset token
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Reset token and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long'
      });
    }

    const result = await authService.resetPassword(resetToken, newPassword);

    res.json(result);

  } catch (error) {
    logger.error('Password reset failed:', error);
    
    if (error.message.includes('Invalid or expired reset token')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Password reset failed. Please try again.'
    });
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile (requires authentication)
 * @access  Private
 */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await authService.getUserProfile(userId);

    res.json(result);

  } catch (error) {
    logger.error('Get user profile failed:', error);
    
    if (error.message.includes('User not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get user profile. Please try again.'
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile (requires authentication)
 * @access  Private
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    const { password_hash, role, is_active, ...allowedUpdates } = updateData;

    const result = await authService.updateUserProfile(userId, allowedUpdates);

    res.json(result);

  } catch (error) {
    logger.error('Update user profile failed:', error);
    
    if (error.message.includes('Username already exists') ||
        error.message.includes('Email already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('No valid fields to update')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update profile. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Private
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    // In a more sophisticated system, you might want to blacklist the refresh token
    // For now, we'll just return success since the client should discard the tokens
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Logout failed. Please try again.'
    });
  }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token and return user info
 * @access  Private
 */
router.get('/verify', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await authService.getUserProfile(userId);

    res.json({
      success: true,
      user: result.user,
      tokenValid: true
    });

  } catch (error) {
    logger.error('Token verification failed:', error);
    
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      tokenValid: false
    });
  }
});

/**
 * @route   GET /api/auth/status
 * @desc    Get authentication status
 * @access  Public
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Authentication service is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /register - User registration',
      'POST /login - User authentication',
      'POST /refresh - Token refresh',
      'POST /change-password - Change password',
      'POST /request-reset - Request password reset',
      'POST /reset-password - Reset password',
      'GET /profile - Get user profile',
      'PUT /profile - Update user profile',
      'POST /logout - User logout',
      'GET /verify - Verify token',
      'GET /status - Service status'
    ]
  });
});

module.exports = router;
