const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { logger } = require('../config/database');
const User = require('../models/User');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_key_678_secure_development_only';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  /**
   * Register a new user
   */
  async registerUser(userData) {
    try {
      const { username, email, password, role = 'user' } = userData;

      // Check if user already exists
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        throw new Error('Email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await User.create({
        username,
        email,
        password_hash: passwordHash,
        role,
        search_quota_daily: 100,
        search_quota_monthly: 1000
      });

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user.id);

      logger.info(`User registered successfully: ${username}`);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          created_at: user.created_at
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } catch (error) {
      logger.error('User registration failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate user login
   */
  async loginUser(credentials) {
    try {
      const { username, password } = credentials;

      // Find user by username or email
      let user = await User.findByUsername(username);
      if (!user) {
        user = await User.findByEmail(username);
      }

      if (!user) {
        throw new Error('Invalid credentials');
      }

      if (!user.is_active) {
        throw new Error('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      await User.updateLastLogin(user.id);

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user.id);

      logger.info(`User logged in successfully: ${user.username}`);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
          last_login: new Date().toISOString()
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } catch (error) {
      logger.error('User login failed:', error);
      throw error;
    }
  }

  /**
   * Generate JWT tokens
   */
  generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiresIn }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return { valid: true, decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const { valid, decoded } = this.verifyToken(refreshToken);
      
      if (!valid || decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Verify user still exists and is active
      const user = await User.findById(decoded.userId);
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        { userId: decoded.userId, type: 'access' },
        this.jwtSecret,
        { expiresIn: this.jwtExpiresIn }
      );

      logger.info(`Access token refreshed for user: ${user.username}`);

      return {
        success: true,
        accessToken: newAccessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      };

    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId, passwordData) {
    try {
      const { currentPassword, newPassword } = passwordData;

      // Get user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await User.updatePassword(userId, newPasswordHash);

      logger.info(`Password changed successfully for user: ${user.username}`);

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      logger.error('Password change failed:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not
        return {
          success: true,
          message: 'If the email exists, a reset link has been sent'
        };
      }

      // Generate reset token (valid for 1 hour)
      const resetToken = jwt.sign(
        { userId: user.id, type: 'reset' },
        this.jwtSecret,
        { expiresIn: '1h' }
      );

      // Store reset token in user record (you might want to add a reset_token field to users table)
      // For now, we'll just log it
      logger.info(`Password reset requested for user: ${user.username}, token: ${resetToken}`);

      // TODO: Send email with reset link
      // In development, we'll just return the token
      if (process.env.NODE_ENV === 'development') {
        return {
          success: true,
          message: 'Password reset link sent (development mode)',
          resetToken: resetToken
        };
      }

      return {
        success: true,
        message: 'If the email exists, a reset link has been sent'
      };

    } catch (error) {
      logger.error('Password reset request failed:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetToken, newPassword) {
    try {
      const { valid, decoded } = this.verifyToken(resetToken);
      
      if (!valid || decoded.type !== 'reset') {
        throw new Error('Invalid or expired reset token');
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await User.updatePassword(decoded.userId, newPasswordHash);

      logger.info(`Password reset successfully for user ID: ${decoded.userId}`);

      return {
        success: true,
        message: 'Password reset successfully'
      };

    } catch (error) {
      logger.error('Password reset failed:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Remove sensitive information
      const { password_hash, ...userProfile } = user;

      return {
        success: true,
        user: userProfile
      };

    } catch (error) {
      logger.error('Get user profile failed:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, updateData) {
    try {
      const allowedFields = ['username', 'email'];
      const filteredData = {};

      // Only allow certain fields to be updated
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      }

      if (Object.keys(filteredData).length === 0) {
        throw new Error('No valid fields to update');
      }

      // Check for uniqueness if updating username or email
      if (filteredData.username) {
        const existingUser = await User.findByUsername(filteredData.username);
        if (existingUser && existingUser.id !== userId) {
          throw new Error('Username already exists');
        }
      }

      if (filteredData.email) {
        const existingUser = await User.findByEmail(filteredData.email);
        if (existingUser && existingUser.id !== userId) {
          throw new Error('Email already exists');
        }
      }

      // Update user
      await User.update(userId, filteredData);

      logger.info(`User profile updated for user ID: ${userId}`);

      return {
        success: true,
        message: 'Profile updated successfully'
      };

    } catch (error) {
      logger.error('Update user profile failed:', error);
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId) {
    try {
      await User.update(userId, { is_active: false });
      
      logger.info(`User account deactivated for user ID: ${userId}`);

      return {
        success: true,
        message: 'Account deactivated successfully'
      };

    } catch (error) {
      logger.error('Deactivate user failed:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission for action
   */
  async checkPermission(userId, action, resource = null) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.is_active) {
        return { hasPermission: false, reason: 'User not found or inactive' };
      }

      // Admin has all permissions
      if (user.role === 'admin') {
        return { hasPermission: true };
      }

      // Check specific permissions based on role and action
      switch (action) {
        case 'search':
          // Check daily quota
          const dailyUsage = await this.getDailySearchUsage(userId);
          if (dailyUsage >= user.search_quota_daily) {
            return { hasPermission: false, reason: 'Daily search quota exceeded' };
          }
          return { hasPermission: true };

        case 'export':
          return { hasPermission: true };

        case 'delete_session':
          return { hasPermission: true };

        default:
          return { hasPermission: false, reason: 'Unknown action' };
      }

    } catch (error) {
      logger.error('Permission check failed:', error);
      return { hasPermission: false, reason: 'Permission check failed' };
    }
  }

  /**
   * Get daily search usage for user
   */
  async getDailySearchUsage(userId) {
    try {
      // This would query the search_history table
      // For now, return 0 (no usage tracked yet)
      return 0;
    } catch (error) {
      logger.error('Get daily search usage failed:', error);
      return 0;
    }
  }
}

module.exports = AuthService;
