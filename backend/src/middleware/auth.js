const jwt = require('jsonwebtoken');
const { logger } = require('../config/database');

class AuthMiddleware {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_key_678_secure_development_only';
  }

  // Verify JWT token and attach user to request
  async authenticateToken(req, res, next) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Access token required',
          code: 'MISSING_TOKEN'
        });
      }

      try {
        const decoded = jwt.verify(token, this.jwtSecret);
        
        // Verify token type
        if (decoded.type !== 'access') {
          return res.status(401).json({
            success: false,
            error: 'Invalid token type',
            code: 'INVALID_TOKEN_TYPE'
          });
        }
        
        req.user = decoded;
        next();
      } catch (tokenError) {
        if (tokenError.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: 'Token has expired',
            code: 'TOKEN_EXPIRED'
          });
        } else if (tokenError.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            error: 'Invalid token',
            code: 'INVALID_TOKEN'
          });
        }
        
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during authentication',
        code: 'AUTH_ERROR'
      });
    }
  }

  // Optional authentication - attach user if token exists, but don't require it
  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        try {
          const decoded = await this.authService.verifyToken(token);
          req.user = decoded;
        } catch (tokenError) {
          // Token is invalid, but we don't fail the request
          logger.warn('Invalid token in optional auth:', tokenError.message);
        }
      }

      next();
    } catch (error) {
      logger.error('Optional authentication middleware error:', error);
      next(); // Continue without authentication
    }
  }

  // Check if user has required role
  requireRole(requiredRole) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // TODO: Implement role-based access control
      // For now, we'll just check if user exists
      if (req.user && req.user.userId) {
        next();
      } else {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
    };
  }

  // Check if user owns the resource or has admin access
  requireOwnership(resourceType, resourceIdParam = 'id') {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
          });
        }

        const resourceId = req.params[resourceIdParam];
        if (!resourceId) {
          return res.status(400).json({
            error: 'Resource ID required',
            code: 'MISSING_RESOURCE_ID'
          });
        }

        // TODO: Implement ownership checking logic
        // For now, we'll just allow authenticated users
        // This should be enhanced with actual resource ownership verification
        
        next();
      } catch (error) {
        logger.error('Ownership check middleware error:', error);
        return res.status(500).json({
          error: 'Internal server error during ownership verification',
          code: 'OWNERSHIP_CHECK_ERROR'
        });
      }
    };
  }

  // Rate limiting middleware
  createRateLimiter(maxRequests, windowMs) {
    const requests = new Map();

    return (req, res, next) => {
      const userId = req.user?.userId || req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;

      if (!requests.has(userId)) {
        requests.set(userId, []);
      }

      const userRequests = requests.get(userId);
      
      // Remove old requests outside the window
      const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
      
      if (validRequests.length >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Add current request
      validRequests.push(now);
      requests.set(userId, validRequests);

      // Clean up old entries periodically
      if (Math.random() < 0.01) { // 1% chance to clean up
        for (const [key, timestamps] of requests.entries()) {
          const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
          if (validTimestamps.length === 0) {
            requests.delete(key);
          } else {
            requests.set(key, validTimestamps);
          }
        }
      }

      next();
    };
  }

  // Subscription tier rate limiting
  createSubscriptionRateLimiter() {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // TODO: Implement subscription-based rate limiting
      // Different tiers should have different limits
      // For now, use default limits
      const defaultLimiter = this.createRateLimiter(100, 60 * 1000); // 100 requests per minute
      return defaultLimiter(req, res, next);
    };
  }

  // Log request details for audit
  logRequest(req, res, next) {
    const startTime = Date.now();
    
    // Log request start
    logger.info('Request started', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId || 'anonymous',
      timestamp: new Date().toISOString()
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - startTime;
      
      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId: req.user?.userId || 'anonymous',
        timestamp: new Date().toISOString()
      });

      originalEnd.call(this, chunk, encoding);
    };

    next();
  }

  // Validate API key for external integrations
  validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }

    // TODO: Implement API key validation
    // This should check against stored API keys and validate permissions
    
    // For now, we'll just check if the key exists
    if (apiKey && apiKey.length > 0) {
      req.apiKey = apiKey;
      next();
    } else {
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }
  }

  // CORS middleware for development
  corsMiddleware(req, res, next) {
    res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  }
}

// Export middleware functions for direct use
const requireAuth = (req, res, next) => {
  const authMiddleware = new AuthMiddleware();
  return authMiddleware.authenticateToken(req, res, next);
};

const requireRole = (role) => {
  const authMiddleware = new AuthMiddleware();
  return authMiddleware.requireRole(role);
};

module.exports = {
  AuthMiddleware,
  requireAuth,
  requireRole
};
