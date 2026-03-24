const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Migration = require('../models/Migration');
const logger = require('./logger');
const {
  DatabaseError,
  ServiceUnavailableError
} = require('./errors');

/**
 * Migration runner system for database schema versioning
 * Tracks, executes, and manages database migrations
 */
class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, '../schemas/migrations');
    this.executedMigrations = new Map();
  }

  /**
   * Get checksum of migration file for integrity checking
   */
  static getChecksum(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Load all migration files from migrations directory
   */
  async loadMigrations() {
    try {
      if (!fs.existsSync(this.migrationsPath)) {
        logger.warn('Migrations directory does not exist, creating it');
        fs.mkdirSync(this.migrationsPath, { recursive: true });
        return [];
      }

      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.js'))
        .sort();

      const migrations = [];
      for (const file of files) {
        try {
          const filePath = path.join(this.migrationsPath, file);
          const migration = require(filePath);
          
          if (!migration.up || typeof migration.up !== 'function') {
            logger.warn(`Migration ${file} does not have up function, skipping`);
            continue;
          }

          migrations.push({
            name: file.replace('.js', ''),
            filePath,
            module: migration,
            checksum: MigrationRunner.getChecksum(filePath)
          });
        } catch (err) {
          logger.error(`Error loading migration ${file}: ${err.message}`);
        }
      }

      return migrations;
    } catch (err) {
      throw DatabaseError.fromConnectionError(err);
    }
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations() {
    try {
      const allMigrations = await this.loadMigrations();
      const executedMigrations = await Migration.getCompletedMigrations();
      const executedNames = new Set(executedMigrations.map(m => m.name));

      return allMigrations.filter(m => !executedNames.has(m.name));
    } catch (err) {
      throw DatabaseError.fromConnectionError(err);
    }
  }

  /**
   * Run all pending migrations in sequence
   */
  async runPendingMigrations() {
    try {
      const pending = await this.getPendingMigrations();
      
      if (pending.length === 0) {
        logger.info('No pending migrations to run');
        return [];
      }

      const batch = await Migration.getLastBatch() + 1;
      const results = [];

      logger.info(`Running ${pending.length} pending migrations (batch ${batch})`);

      for (const migration of pending) {
        const result = await this.runSingleMigration(migration, batch);
        results.push(result);

        if (!result.success) {
          logger.error(`Migration ${migration.name} failed, stopping batch`);
          break;
        }
      }

      logger.info(`Completed ${results.filter(r => r.success).length}/${pending.length} migrations`);
      return results;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Run a single migration
   */
  async runSingleMigration(migration, batch) {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting migration: ${migration.name}`);

      // Run the up function
      await migration.module.up();

      const duration = Date.now() - startTime;

      // Record successful migration
      const record = await Migration.recordMigration({
        name: migration.name,
        version: migration.module.version || '1.0.0',
        description: migration.module.description || migration.name,
        status: 'completed',
        duration,
        checksum: migration.checksum,
        batch,
        rollbackable: migration.module.rollbackable !== false,
        notes: migration.module.notes
      });

      logger.info(`Migration ${migration.name} completed in ${duration}ms`);
      
      return {
        success: true,
        name: migration.name,
        duration,
        record: record.toJSON()
      };
    } catch (err) {
      const duration = Date.now() - startTime;

      // Record failed migration
      const record = await Migration.recordMigration({
        name: migration.name,
        version: migration.module.version || '1.0.0',
        description: migration.module.description || migration.name,
        status: 'failed',
        error: err.message,
        duration,
        checksum: migration.checksum,
        batch,
        rollbackable: false,
        notes: `Failed: ${err.stack}`
      });

      logger.error(`Migration ${migration.name} failed: ${err.message}`);

      return {
        success: false,
        name: migration.name,
        error: err.message,
        duration,
        record: record.toJSON()
      };
    }
  }

  /**
   * Rollback the last migration
   */
  async rollbackMigration(name) {
    try {
      const migrationRecord = await Migration.findOne({ name, status: 'completed' });
      
      if (!migrationRecord) {
        throw new Error(`Migration ${name} not found or not completed`);
      }

      if (!migrationRecord.rollbackable) {
        throw new Error(`Migration ${name} is not rollbackable`);
      }

      const allMigrations = await this.loadMigrations();
      const migration = allMigrations.find(m => m.name === name);

      if (!migration || !migration.module.down) {
        throw new Error(`Migration ${name} has no rollback function`);
      }

      const startTime = Date.now();

      try {
        await migration.module.down();
        const duration = Date.now() - startTime;

        await Migration.rollbackMigration(name);

        logger.info(`Migration ${name} rolled back in ${duration}ms`);
        
        return {
          success: true,
          name,
          duration
        };
      } catch (err) {
        throw new Error(`Rollback failed for ${name}: ${err.message}`);
      }
    } catch (err) {
      throw DatabaseError.fromConnectionError(err);
    }
  }

  /**
   * Get migration status report
   */
  async getStatus() {
    try {
      const completed = await Migration.getCompletedMigrations();
      const failed = await Migration.getFailedMigrations();
      const pending = await this.getPendingMigrations();

      return {
        completed: completed.map(m => m.toJSON()),
        failed: failed.map(m => m.toJSON()),
        pending: pending.map(m => ({
          name: m.name,
          version: m.module.version || '1.0.0',
          description: m.module.description || m.name
        })),
        summary: {
          totalCompleted: completed.length,
          totalFailed: failed.length,
          totalPending: pending.length,
          lastBatch: await Migration.getLastBatch()
        }
      };
    } catch (err) {
      throw DatabaseError.fromConnectionError(err);
    }
  }

  /**
   * Verify migration integrity
   */
  async verifyIntegrity() {
    try {
      const completed = await Migration.getCompletedMigrations();
      const issues = [];

      for (const migrationRecord of completed) {
        const allMigrations = await this.loadMigrations();
        const migration = allMigrations.find(m => m.name === migrationRecord.name);

        if (!migration) {
          issues.push({
            name: migrationRecord.name,
            issue: 'Migration file not found'
          });
          continue;
        }

        if (migration.checksum !== migrationRecord.checksum) {
          issues.push({
            name: migrationRecord.name,
            issue: 'Checksum mismatch - file has been modified'
          });
        }
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (err) {
      throw DatabaseError.fromConnectionError(err);
    }
  }
}

module.exports = new MigrationRunner();
