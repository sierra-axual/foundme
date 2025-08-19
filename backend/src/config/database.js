const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'database' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// PostgreSQL Connection Pool Configuration
const postgresConfig = {
  user: process.env.POSTGRES_USER || 'foundme_user',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'foundme_db',
  password: process.env.POSTGRES_PASSWORD || 'foundme_password',
  port: process.env.POSTGRES_PORT || 5432,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  maxUses: 7500, // Close (and replace) a connection after it has been used 7500 times
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create PostgreSQL connection pool
const postgresPool = new Pool(postgresConfig);

// PostgreSQL connection event handlers
postgresPool.on('connect', (client) => {
  logger.info('New PostgreSQL client connected');
});

postgresPool.on('error', (err, client) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

postgresPool.on('remove', (client) => {
  logger.info('PostgreSQL client removed from pool');
});

// Redis Configuration
const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis max retry attempts reached');
        return new Error('Redis max retry attempts reached');
      }
      return Math.min(retries * 100, 3000);
    }
  },
  password: process.env.REDIS_PASSWORD || null,
  database: process.env.REDIS_DB || 0
};

// Create Redis client
const redisClient = Redis.createClient(redisConfig);

// Redis connection event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error:', err);
});

redisClient.on('end', () => {
  logger.info('Redis client connection ended');
});

// Connect to Redis
redisClient.connect().catch((err) => {
  logger.error('Failed to connect to Redis:', err);
});

// Health check function
async function checkDatabaseHealth() {
  try {
    // Check PostgreSQL
    const postgresResult = await postgresPool.query('SELECT NOW() as timestamp, version() as version');
    logger.info('PostgreSQL health check passed', { 
      timestamp: postgresResult.rows[0].timestamp,
      version: postgresResult.rows[0].version.split(' ')[0]
    });

    // Check Redis
    const redisResult = await redisClient.ping();
    if (redisResult === 'PONG') {
      logger.info('Redis health check passed');
    } else {
      throw new Error('Redis ping failed');
    }

    return {
      postgres: 'healthy',
      redis: 'healthy',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    throw error;
  }
}

// Graceful shutdown function
async function closeConnections() {
  try {
    logger.info('Closing database connections...');
    
    // Close PostgreSQL pool
    await postgresPool.end();
    logger.info('PostgreSQL connections closed');
    
    // Close Redis client
    await redisClient.quit();
    logger.info('Redis connections closed');
    
    logger.info('All database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
}

// Test connection function
async function testConnections() {
  try {
    logger.info('Testing database connections...');
    
    // Test PostgreSQL
    const postgresTest = await postgresPool.query('SELECT 1 as test');
    if (postgresTest.rows[0].test === 1) {
      logger.info('PostgreSQL connection test passed');
    }
    
    // Test Redis
    const redisTest = await redisClient.set('test', 'connection_test');
    if (redisTest === 'OK') {
      const redisGetTest = await redisClient.get('test');
      if (redisGetTest === 'connection_test') {
        logger.info('Redis connection test passed');
        await redisClient.del('test'); // Clean up test key
      }
    }
    
    logger.info('All database connection tests passed');
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    throw error;
  }
}

module.exports = {
  postgresPool,
  redisClient,
  checkDatabaseHealth,
  closeConnections,
  testConnections,
  logger
};
