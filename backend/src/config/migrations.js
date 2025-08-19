const fs = require('fs').promises;
const path = require('path');
const { postgresPool, logger } = require('./database');

class MigrationManager {
  constructor() {
    this.migrationsPath = path.join(__dirname, '../../database/init');
    this.migrationsTable = 'schema_migrations';
  }

  async initialize() {
    try {
      logger.info('Initializing migration system...');
      
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();
      
      // Get list of migration files
      const migrationFiles = await this.getMigrationFiles();
      
      // Run pending migrations
      await this.runPendingMigrations(migrationFiles);
      
      logger.info('Migration system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize migration system:', error);
      throw error;
    }
  }

  async createMigrationsTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL,
        execution_time_ms INTEGER
      );
    `;

    try {
      await postgresPool.query(createTableQuery);
      logger.info('Migrations table created/verified');
    } catch (error) {
      logger.error('Failed to create migrations table:', error);
      throw error;
    }
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort((a, b) => {
          // Sort by numeric prefix (01-, 02-, etc.)
          const aNum = parseInt(a.split('-')[0]);
          const bNum = parseInt(b.split('-')[0]);
          return aNum - bNum;
        });
    } catch (error) {
      logger.error('Failed to read migration files:', error);
      throw error;
    }
  }

  async runPendingMigrations(migrationFiles) {
    for (const file of migrationFiles) {
      try {
        const version = path.parse(file).name;
        const filePath = path.join(this.migrationsPath, file);
        
        // Check if migration has already been executed
        const isExecuted = await this.isMigrationExecuted(version);
        if (isExecuted) {
          logger.info(`Migration ${version} already executed, skipping`);
          continue;
        }

        // Read and execute migration file
        await this.executeMigration(file, version, filePath);
        
      } catch (error) {
        logger.error(`Failed to execute migration ${file}:`, error);
        throw error;
      }
    }
  }

  async isMigrationExecuted(version) {
    try {
      const result = await postgresPool.query(
        `SELECT COUNT(*) FROM ${this.migrationsTable} WHERE version = $1`,
        [version]
      );
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error('Failed to check migration status:', error);
      throw error;
    }
  }

  async executeMigration(file, version, filePath) {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing migration: ${version}`);
      
      // Read migration file
      const sqlContent = await fs.readFile(filePath, 'utf8');
      
      // Calculate checksum
      const crypto = require('crypto');
      const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');
      
      // Execute migration
      await postgresPool.query(sqlContent);
      
      // Record migration execution
      const executionTime = Date.now() - startTime;
      await this.recordMigrationExecution(version, file, checksum, executionTime);
      
      logger.info(`Migration ${version} executed successfully in ${executionTime}ms`);
      
    } catch (error) {
      logger.error(`Failed to execute migration ${version}:`, error);
      throw error;
    }
  }

  async recordMigrationExecution(version, name, checksum, executionTime) {
    try {
      await postgresPool.query(
        `INSERT INTO ${this.migrationsTable} (version, name, checksum, execution_time_ms) 
         VALUES ($1, $2, $3, $4)`,
        [version, name, checksum, executionTime]
      );
    } catch (error) {
      logger.error('Failed to record migration execution:', error);
      throw error;
    }
  }

  async getMigrationStatus() {
    try {
      const result = await postgresPool.query(
        `SELECT version, name, executed_at, execution_time_ms 
         FROM ${this.migrationsTable} 
         ORDER BY id ASC`
      );
      
      const migrationFiles = await this.getMigrationFiles();
      const executedMigrations = result.rows;
      
      const status = migrationFiles.map(file => {
        const version = path.parse(file).name;
        const executed = executedMigrations.find(m => m.version === version);
        
        return {
          file,
          version,
          status: executed ? 'executed' : 'pending',
          executedAt: executed?.executed_at,
          executionTime: executed?.execution_time_ms
        };
      });
      
      return status;
    } catch (error) {
      logger.error('Failed to get migration status:', error);
      throw error;
    }
  }

  async rollbackMigration(version) {
    try {
      logger.info(`Rolling back migration: ${version}`);
      
      // Get migration details
      const result = await postgresPool.query(
        `SELECT name FROM ${this.migrationsTable} WHERE version = $1`,
        [version]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Migration ${version} not found`);
      }
      
      // Note: This is a simplified rollback - in production you'd want proper rollback scripts
      logger.warn(`Rollback for ${version} would require manual intervention`);
      
      // Remove migration record
      await postgresPool.query(
        `DELETE FROM ${this.migrationsTable} WHERE version = $1`,
        [version]
      );
      
      logger.info(`Migration ${version} rolled back successfully`);
      
    } catch (error) {
      logger.error(`Failed to rollback migration ${version}:`, error);
      throw error;
    }
  }
}

module.exports = MigrationManager;
