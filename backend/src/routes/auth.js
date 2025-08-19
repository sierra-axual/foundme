const express = require('express');
const AuthService = require('../services/authService');
const AuthMiddleware = require('../middleware/auth');
const { logger } = require('../config/database');

const router = express.Router();
const authService = new AuthService();
const authMiddleware = new AuthMiddleware();

// User registration
router.post('/register', async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);
    
    res.status(201).json({
      message: 'User registered successfully',
      ...result
    });
  } catch (error) {
    logger.error('Registration route error:', error);
    
    if (error.message === 'User with this email already exists') {
      return res.status(409).json({
        error: error.message,
        code: 'USER_EXISTS'
      });
    }
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Internal server error during registration',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const result = await authService.loginUser(req.body);
    
    res.status(200).json({
      message: 'Login successful',
      ...result
    });
  } catch (error) {
    logger.error('Login route error:', error);
    
    if (error.message === 'Invalid email or password') {
      return res.status(401).json({
        error: error.message,
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    if (error.message.includes('Account is locked')) {
      return res.status(423).json({
        error: error.message,
        code: 'ACCOUNT_LOCKED'
      });
    }
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Internal server error during login',
      code: 'LOGIN_ERROR'
    });
  }
});

// Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }
    
    const result = await authService.refreshAccessToken(refreshToken);
    
    res.status(200).json({
      message: 'Token refreshed successfully',
      ...result
    });
  } catch (error) {
    logger.error('Token refresh route error:', error);
    
    if (error.message === 'Invalid refresh token') {
      return res.status(401).json({
        error: error.message,
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    res.status(500).json({
      error: 'Internal server error during token refresh',
      code: 'REFRESH_ERROR'
    });
  }
});

// Logout
router.post('/logout', authMiddleware.authenticateToken.bind(authMiddleware), async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }
    
    const result = await authService.logout(req.user.userId, refreshToken);
    
    res.status(200).json(result);
  } catch (error) {
    logger.error('Logout route error:', error);
    
    res.status(500).json({
      error: 'Internal server error during logout',
      code: 'LOGOUT_ERROR'
    });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const result = await authService.requestPasswordReset(req.body.email);
    
    res.status(200).json(result);
  } catch (error) {
    logger.error('Password reset request route error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Internal server error during password reset request',
      code: 'PASSWORD_RESET_ERROR'
    });
  }
});

// Change password (authenticated)
router.post('/change-password', authMiddleware.authenticateToken.bind(authMiddleware), async (req, res) => {
  try {
    const result = await authService.changePassword(req.user.userId, req.body);
    
    res.status(200).json(result);
  } catch (error) {
    logger.error('Password change route error:', error);
    
    if (error.message === 'Current password is incorrect') {
      return res.status(400).json({
        error: error.message,
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Internal server error during password change',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

// Get current user profile
router.get('/profile', authMiddleware.authenticateToken.bind(authMiddleware), async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Remove sensitive information
    const { password_hash, ...userProfile } = user;
    
    res.status(200).json({
      user: userProfile
    });
  } catch (error) {
    logger.error('Profile fetch route error:', error);
    
    res.status(500).json({
      error: 'Internal server error fetching profile',
      code: 'PROFILE_FETCH_ERROR'
    });
  }
});

// Health check for auth service
router.get('/health', async (req, res) => {
  try {
    res.status(200).json({
      status: 'OK',
      service: 'Authentication Service',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Auth health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      service: 'Authentication Service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
