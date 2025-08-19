const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import database and migration modules
const { checkDatabaseHealth, closeConnections, logger } = require('./config/database');
const MigrationManager = require('./config/migrations');
const AuthMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database and migrations
let migrationManager;

async function initializeDatabase() {
  try {
    logger.info('Initializing database connections...');
    
    // Test database connections
    await checkDatabaseHealth();
    logger.info('Database connections established successfully');
    
    // Initialize migrations
    migrationManager = new MigrationManager();
    await migrationManager.initialize();
    logger.info('Database migrations completed successfully');
    
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:8472', 'http://127.0.0.1:8472'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Initialize auth middleware
const authMiddleware = new AuthMiddleware();

// Request logging middleware
app.use(authMiddleware.logRequest.bind(authMiddleware));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: dbHealth
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      error: error.message
    });
  }
});

// Database status endpoint
app.get('/api/db/status', async (req, res) => {
  try {
    if (migrationManager) {
      const migrationStatus = await migrationManager.getMigrationStatus();
      res.json({
        status: 'OK',
        migrations: migrationStatus,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'ERROR',
        error: 'Migration manager not initialized',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Database status check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/discovery', require('./routes/discovery'));
app.use('/api/risk', require('./routes/risk'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/notification', require('./routes/notification'));

// Test Routes (Development only)
if (process.env.NODE_ENV === 'development') {
  app.use('/api/test', require('./routes/test'));
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.userId || 'anonymous'
  });
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      code: err.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await closeConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await closeConnections();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize database first
    await initializeDatabase();
    
    // Start listening
    app.listen(PORT, () => {
      logger.info(`🚀 FoundMe Backend Server running on port ${PORT}`);
      logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🗄️ Database status: http://localhost:${PORT}/api/db/status`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
