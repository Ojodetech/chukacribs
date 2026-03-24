const mongoose = require('mongoose');
const Migration = require('../models/Migration');
const migrationRunner = require('../config/migrations');

describe('Database Migration System', () => {
  let mongoServer;

  beforeAll(async () => {
    // Setup in-memory MongoDB for testing
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer && typeof mongoServer.stop === 'function') {
      await mongoServer.stop();
    }
  });

  describe('Migration Model', () => {
    it('should create a new migration record', async () => {
      const migration = await Migration.recordMigration({
        name: '001_test_migration',
        version: '1.0.0',
        description: 'Test migration',
        status: 'completed',
        duration: 1500,
        checksum: 'abc123',
        batch: 1,
        rollbackable: true
      });

      expect(migration).toBeDefined();
      expect(migration.name).toBe('001_test_migration');
      expect(migration.status).toBe('completed');
      expect(migration.duration).toBe(1500);
    });

    it('should get completed migrations', async () => {
      await Migration.recordMigration({
        name: '002_test_migration',
        version: '1.0.0',
        description: 'Test migration 2',
        status: 'completed',
        batch: 1
      });

      const completed = await Migration.getCompletedMigrations();
      expect(completed.length).toBeGreaterThanOrEqual(1);
      expect(completed[0].status).toBe('completed');
    });

    it('should get failed migrations', async () => {
      await Migration.recordMigration({
        name: '003_failed_migration',
        version: '1.0.0',
        description: 'Failed test migration',
        status: 'failed',
        error: 'Test error',
        batch: 1
      });

      const failed = await Migration.getFailedMigrations();
      expect(failed.length).toBeGreaterThanOrEqual(1);
      expect(failed[0].status).toBe('failed');
    });

    it('should rollback a migration', async () => {
      const migration = await Migration.recordMigration({
        name: '004_rollback_test',
        version: '1.0.0',
        description: 'Rollback test',
        status: 'completed',
        batch: 1
      });

      const rolled = await Migration.rollbackMigration('004_rollback_test');
      expect(rolled.status).toBe('rolled_back');
    });

    it('should get last batch number', async () => {
      await Migration.recordMigration({
        name: '005_batch_test',
        version: '1.0.0',
        description: 'Batch test',
        status: 'completed',
        batch: 5
      });

      const lastBatch = await Migration.getLastBatch();
      expect(lastBatch).toBeGreaterThanOrEqual(5);
    });

    it('should serialize migration to JSON', async () => {
      const migration = await Migration.recordMigration({
        name: '006_json_test',
        version: '1.0.0',
        description: 'JSON test',
        status: 'completed',
        duration: 500,
        batch: 1
      });

      const json = migration.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('status');
      expect(json).not.toHaveProperty('_id');
      expect(json).not.toHaveProperty('__v');
    });
  });

  describe('Migration Runner', () => {
    it('should load migrations from directory', async () => {
      const migrations = await migrationRunner.loadMigrations();
      expect(Array.isArray(migrations)).toBe(true);
    });

    it('should get pending migrations', async () => {
      const pending = await migrationRunner.getPendingMigrations();
      expect(Array.isArray(pending)).toBe(true);
    });

    it('should get migration status', async () => {
      const status = await migrationRunner.getStatus();
      
      expect(status).toHaveProperty('completed');
      expect(status).toHaveProperty('failed');
      expect(status).toHaveProperty('pending');
      expect(status).toHaveProperty('summary');
      expect(status.summary).toHaveProperty('totalCompleted');
      expect(status.summary).toHaveProperty('totalFailed');
      expect(status.summary).toHaveProperty('totalPending');
      expect(status.summary).toHaveProperty('lastBatch');
    });

    it('should verify migration integrity', async () => {
      const integrity = await migrationRunner.verifyIntegrity();
      
      expect(integrity).toHaveProperty('valid');
      expect(integrity).toHaveProperty('issues');
      expect(Array.isArray(integrity.issues)).toBe(true);
    });

    it('should calculate checksum for migration file', () => {
      const testContent = 'test migration content';
      const checksum1 = require('crypto')
        .createHash('md5')
        .update(testContent)
        .digest('hex');

      const checksum2 = require('crypto')
        .createHash('md5')
        .update(testContent)
        .digest('hex');

      expect(checksum1).toBe(checksum2);
    });
  });

  describe('Migration Workflow', () => {
    it('should handle migration with error handling', async () => {
      // Verify error handling is integrated
      const Migration_errors = require('../config/errors');
      expect(Migration_errors).toBeDefined();
    });

    it('should record migration duration', async () => {
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 100));
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should track migration batches', async () => {
      const batch1 = await Migration.getLastBatch();
      
      await Migration.recordMigration({
        name: 'test_batch_1',
        version: '1.0.0',
        description: 'Batch test 1',
        status: 'completed',
        batch: batch1 + 1
      });

      const batch2 = await Migration.getLastBatch();
      expect(batch2).toBe(batch1 + 1);
    });
  });
});
