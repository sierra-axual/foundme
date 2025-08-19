const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { postgresPool, redisClient, logger } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Validation schemas
const userRegistrationSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  ),
  firstName: z.string().min(2).max(50).trim(),
  lastName: z.string().min(2).max(50).trim(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional()
});

const userLoginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, 'Password is required')
});

const passwordResetSchema = z.object({
  email: z.string().email().toLowerCase().trim()
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  )
});

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    this.maxLoginAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
  }

  // User Registration
  async registerUser(userData) {
    try {
      // Validate input data
      const validatedData = userRegistrationSchema.parse(userData);
      
      // Check if user already exists
      const existingUser = await this.getUserByEmail(validatedData.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(validatedData.password, saltRounds);

      // Create user
      const userId = uuidv4();
      const query = `
        INSERT INTO users (id, email, password_hash, first_name, last_name, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, email, first_name, last_name, created_at
      `;

      const values = [
        userId,
        validatedData.email,
        hashedPassword,
        validatedData.firstName,
        validatedData.lastName
      ];

      const result = await postgresPool.query(query, values);
      const newUser = result.rows[0];

      // Create user profile
      await this.createUserProfile(userId, validatedData);

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(newUser);

      logger.info(`User registered successfully: ${newUser.email}`);

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          createdAt: newUser.created_at
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      logger.error('User registration failed:', error);
      throw error;
    }
  }

  // User Login
  async loginUser(loginData) {
    try {
      // Validate input data
      const validatedData = userLoginSchema.parse(loginData);

      // Get user by email
      const user = await this.getUserByEmail(validatedData.email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check if account is locked
      if (user.locked_until && new Date() < user.locked_until) {
        const remainingTime = Math.ceil((user.locked_until - new Date()) / 1000 / 60);
        throw new Error(`Account is locked. Try again in ${remainingTime} minutes`);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password_hash);
      if (!isPasswordValid) {
        await this.recordFailedLogin(user.id);
        throw new Error('Invalid email or password');
      }

      // Reset failed login attempts on successful login
      if (user.failed_login_attempts > 0) {
        await this.resetFailedLoginAttempts(user.id);
      }

      // Update last login
      await this.updateLastLogin(user.id);

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(user);

      // Store refresh token in Redis
      await this.storeRefreshToken(user.id, refreshToken);

      logger.info(`User logged in successfully: ${user.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          lastLoginAt: user.last_login_at
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      logger.error('User login failed:', error);
      throw error;
    }
  }

  // Generate JWT Tokens
  async generateTokens(user) {
    try {
      const payload = {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      };

      const accessToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn
      });

      const refreshToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.refreshTokenExpiresIn
      });

      return { accessToken, refreshToken };
    } catch (error) {
      logger.error('Token generation failed:', error);
      throw error;
    }
  }

  // Verify JWT Token
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  // Refresh Access Token
  async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = await this.verifyToken(refreshToken);
      
      // Check if refresh token exists in Redis
      const storedToken = await this.getRefreshToken(decoded.userId);
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Get user data
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new access token
      const { accessToken } = await this.generateTokens(user);

      return { accessToken };

    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  // Password Reset Request
  async requestPasswordReset(email) {
    try {
      const validatedData = passwordResetSchema.parse({ email });

      const user = await this.getUserByEmail(validatedData.email);
      if (!user) {
        // Don't reveal if user exists or not
        return { message: 'If an account with this email exists, a password reset link has been sent' };
      }

      // Generate reset token
      const resetToken = nanoid(32);
      const resetTokenHash = await bcrypt.hash(resetToken, 10);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await this.storePasswordResetToken(user.id, resetTokenHash, expiresAt);

      // TODO: Send email with reset link
      logger.info(`Password reset requested for user: ${user.email}`);

      return { message: 'If an account with this email exists, a password reset link has been sent' };

    } catch (error) {
      logger.error('Password reset request failed:', error);
      throw error;
    }
  }

  // Change Password
  async changePassword(userId, passwordData) {
    try {
      const validatedData = passwordChangeSchema.parse(passwordData);

      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(validatedData.currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(validatedData.newPassword, saltRounds);

      // Update password
      await postgresPool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, userId]
      );

      // Invalidate all refresh tokens for this user
      await this.invalidateUserRefreshTokens(userId);

      logger.info(`Password changed successfully for user: ${user.email}`);

      return { message: 'Password changed successfully' };

    } catch (error) {
      logger.error('Password change failed:', error);
      throw error;
    }
  }

  // Logout
  async logout(userId, refreshToken) {
    try {
      // Remove refresh token from Redis
      await this.removeRefreshToken(userId, refreshToken);
      
      logger.info(`User logged out: ${userId}`);
      
      return { message: 'Logged out successfully' };
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  // Helper Methods
  async getUserByEmail(email) {
    try {
      const result = await postgresPool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get user by email:', error);
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      const result = await postgresPool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  async createUserProfile(userId, userData = {}) {
    try {
      const query = `
        INSERT INTO user_profiles (
          user_id, 
          phone, 
          company, 
          job_title, 
          created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `;
      
      const values = [
        userId,
        userData.phone || null,
        userData.company || null,
        userData.jobTitle || null
      ];
      
      await postgresPool.query(query, values);
    } catch (error) {
      logger.error('Failed to create user profile:', error);
      throw error;
    }
  }

  async recordFailedLogin(userId) {
    try {
      const result = await postgresPool.query(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, updated_at = NOW() WHERE id = $1 RETURNING failed_login_attempts',
        [userId]
      );

      const failedAttempts = result.rows[0].failed_login_attempts;

      // Lock account if max attempts reached
      if (failedAttempts >= this.maxLoginAttempts) {
        const lockoutUntil = new Date(Date.now() + this.lockoutDuration);
        await postgresPool.query(
          'UPDATE users SET locked_until = $1 WHERE id = $2',
          [lockoutUntil, userId]
        );
        logger.warn(`Account locked for user: ${userId} due to multiple failed login attempts`);
      }
    } catch (error) {
      logger.error('Failed to record failed login:', error);
    }
  }

  async resetFailedLoginAttempts(userId) {
    try {
      await postgresPool.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1',
        [userId]
      );
    } catch (error) {
      logger.error('Failed to reset failed login attempts:', error);
    }
  }

  async updateLastLogin(userId) {
    try {
      await postgresPool.query(
        'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
        [userId]
      );
    } catch (error) {
      logger.error('Failed to update last login:', error);
    }
  }

  async storeRefreshToken(userId, refreshToken) {
    try {
      const key = `refresh_token:${userId}`;
      await redisClient.setEx(key, parseInt(this.refreshTokenExpiresIn) * 24 * 60 * 60, refreshToken);
    } catch (error) {
      logger.error('Failed to store refresh token:', error);
    }
  }

  async getRefreshToken(userId) {
    try {
      const key = `refresh_token:${userId}`;
      return await redisClient.get(key);
    } catch (error) {
      logger.error('Failed to get refresh token:', error);
      return null;
    }
  }

  async removeRefreshToken(userId, refreshToken) {
    try {
      const key = `refresh_token:${userId}`;
      await redisClient.del(key);
    } catch (error) {
      logger.error('Failed to remove refresh token:', error);
    }
  }

  async invalidateUserRefreshTokens(userId) {
    try {
      const key = `refresh_token:${userId}`;
      await redisClient.del(key);
    } catch (error) {
      logger.error('Failed to invalidate user refresh tokens:', error);
    }
  }

  async storePasswordResetToken(userId, tokenHash, expiresAt) {
    try {
      await postgresPool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [userId, tokenHash, expiresAt]
      );
    } catch (error) {
      logger.error('Failed to store password reset token:', error);
      throw error;
    }
  }
}

module.exports = AuthService;
