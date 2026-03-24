/**
 * Backup Management Routes
 * Handles backup creation, listing, and recovery operations
 */

const express = require('express');
const BackupManager = require('../config/backupManager');
const { verifyToken, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Initialize backup manager
const backupManager = new BackupManager({
  backupDir: process.env.BACKUP_DIR || './backups',
  mongoUri: process.env.MONGODB_URI,
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
  mongoBackupSchedule: process.env.MONGO_BACKUP_SCHEDULE || '0 2 * * *',
  redisBackupSchedule: process.env.REDIS_BACKUP_SCHEDULE || '0 3 * * *',
  compression: process.env.BACKUP_COMPRESSION !== 'false',
  s3Enabled: process.env.S3_BACKUP_ENABLED === 'true',
  s3Config: process.env.S3_BACKUP_ENABLED === 'true' ? {
    bucket: process.env.S3_BUCKET,
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : {}
});

// Schedule automated backups on route initialization
backupManager.scheduleBackups();

/**
 * GET /api/backups
 * List all available backups
 * Query: ?type=mongodb|redis (optional filter)
 */
router.get('/', verifyToken, adminOnly, (req, res) => {
  try {
    const { type } = req.query;
    const backups = backupManager.listBackups(type);

    res.json({
      success: true,
      count: backups.length,
      backups: backups.map(b => ({
        name: b.name,
        type: b.type,
        size: (b.size / 1024 / 1024).toFixed(2) + ' MB',
        created: b.created,
        modified: b.modified
      }))
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to list backups',
      error: err.message
    });
  }
});

/**
 * GET /api/backups/stats
 * Get backup statistics
 */
router.get('/stats', verifyToken, adminOnly, (req, res) => {
  try {
    const stats = backupManager.getStatistics();

    res.json({
      success: true,
      statistics: {
        totalBackups: stats.totalBackupCount,
        mongoBackups: stats.mongoBackupCount,
        redisBackups: stats.redisBackupCount,
        totalDiskUsage: (stats.diskUsage / 1024 / 1024).toFixed(2) + ' MB',
        lastMongoBackup: stats.lastMongoBackup,
        lastRedisBackup: stats.lastRedisBackup,
        failedBackups: stats.failedBackups,
        oldestBackup: stats.oldestBackup,
        newestBackup: stats.newestBackup,
        retentionDays: backupManager.config.retentionDays
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics',
      error: err.message
    });
  }
});

/**
 * POST /api/backups/mongodb
 * Create a manual MongoDB backup
 */
router.post('/mongodb', verifyToken, adminOnly, async (req, res) => {
  try {
    console.log('📦 Creating manual MongoDB backup...');
    const backup = await backupManager.backupMongoDB();

    res.json({
      success: true,
      message: 'MongoDB backup created successfully',
      backup: {
        name: backup.name,
        path: backup.path,
        size: (backup.size / 1024 / 1024).toFixed(2) + ' MB',
        timestamp: backup.timestamp
      }
    });
  } catch (err) {
    console.error('❌ Backup failed:', err);
    res.status(500).json({
      success: false,
      message: 'MongoDB backup failed',
      error: err.message
    });
  }
});

/**
 * POST /api/backups/redis
 * Create a manual Redis backup
 */
router.post('/redis', verifyToken, adminOnly, async (req, res) => {
  try {
    console.log('📦 Creating manual Redis backup...');
    const backup = await backupManager.backupRedis();

    res.json({
      success: true,
      message: 'Redis backup created successfully',
      backup: {
        name: backup.name,
        path: backup.path,
        size: (backup.size / 1024).toFixed(2) + ' KB',
        timestamp: backup.timestamp
      }
    });
  } catch (err) {
    console.error('❌ Backup failed:', err);
    res.status(500).json({
      success: false,
      message: 'Redis backup failed',
      error: err.message
    });
  }
});

/**
 * POST /api/backups/both
 * Create both MongoDB and Redis backups
 */
router.post('/both', verifyToken, adminOnly, async (req, res) => {
  try {
    console.log('📦 Creating MongoDB and Redis backups...');
    
    const mongoBackup = await backupManager.backupMongoDB();
    const redisBackup = await backupManager.backupRedis();

    res.json({
      success: true,
      message: 'Full backups created successfully',
      backups: {
        mongodb: {
          name: mongoBackup.name,
          size: (mongoBackup.size / 1024 / 1024).toFixed(2) + ' MB',
          timestamp: mongoBackup.timestamp
        },
        redis: {
          name: redisBackup.name,
          size: (redisBackup.size / 1024).toFixed(2) + ' KB',
          timestamp: redisBackup.timestamp
        }
      }
    });
  } catch (err) {
    console.error('❌ Backup failed:', err);
    res.status(500).json({
      success: false,
      message: 'Full backup failed',
      error: err.message
    });
  }
});

/**
 * POST /api/backups/restore/mongodb
 * Restore MongoDB from a specific backup
 * Body: { backupName: "mongodb-backup-2024-02-08T14-30-45-123Z" }
 */
router.post('/restore/mongodb', verifyToken, adminOnly, async (req, res) => {
  try {
    const { backupName } = req.body;

    if (!backupName) {
      return res.status(400).json({
        success: false,
        message: 'backupName is required'
      });
    }

    const backupPath = `${backupManager.config.backupDir}/${backupName}`;
    console.log(`🔄 Restoring MongoDB from ${backupName}...`);

    const result = await backupManager.restoreMongoDB(backupPath);

    res.json({
      success: true,
      message: 'MongoDB restored successfully',
      result
    });
  } catch (err) {
    console.error('❌ Restore failed:', err);
    res.status(500).json({
      success: false,
      message: 'MongoDB restore failed',
      error: err.message
    });
  }
});

/**
 * POST /api/backups/restore/redis
 * Restore Redis from a specific backup
 * Body: { backupName: "redis-backup-2024-02-08T14-30-45-123Z.rdb", redisDumpDir: "/var/lib/redis" }
 */
router.post('/restore/redis', verifyToken, adminOnly, async (req, res) => {
  try {
    const { backupName, redisDumpDir } = req.body;

    if (!backupName) {
      return res.status(400).json({
        success: false,
        message: 'backupName is required'
      });
    }

    const backupPath = `${backupManager.config.backupDir}/${backupName}`;
    console.log(`🔄 Restoring Redis from ${backupName}...`);

    const result = await backupManager.restoreRedis(
      backupPath,
      redisDumpDir || '/var/lib/redis'
    );

    res.json({
      success: true,
      message: 'Redis restore initiated',
      result
    });
  } catch (err) {
    console.error('❌ Restore failed:', err);
    res.status(500).json({
      success: false,
      message: 'Redis restore failed',
      error: err.message
    });
  }
});

/**
 * POST /api/backups/cleanup
 * Manually trigger cleanup of old backups
 */
router.post('/cleanup', verifyToken, adminOnly, async (req, res) => {
  try {
    console.log('🧹 Running manual backup cleanup...');
    const result = await backupManager.cleanupOldBackups();

    res.json({
      success: true,
      message: 'Cleanup completed',
      result: {
        deletedCount: result.deletedCount,
        freedSpace: (result.freedSpace / 1024 / 1024).toFixed(2) + ' MB'
      }
    });
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    res.status(500).json({
      success: false,
      message: 'Cleanup failed',
      error: err.message
    });
  }
});

/**
 * POST /api/backups/strategy
 * Configure backup strategy
 * Body: { retentionDays, mongoBackupSchedule, redisBackupSchedule, compression }
 */
router.post('/strategy', verifyToken, adminOnly, (req, res) => {
  try {
    const { retentionDays, mongoBackupSchedule, redisBackupSchedule, compression } = req.body;

    if (retentionDays) backupManager.config.retentionDays = retentionDays;
    if (mongoBackupSchedule) backupManager.config.mongoBackupSchedule = mongoBackupSchedule;
    if (redisBackupSchedule) backupManager.config.redisBackupSchedule = redisBackupSchedule;
    if (compression !== undefined) backupManager.config.compression = compression;

    res.json({
      success: true,
      message: 'Backup strategy updated',
      config: {
        retentionDays: backupManager.config.retentionDays,
        mongoBackupSchedule: backupManager.config.mongoBackupSchedule,
        redisBackupSchedule: backupManager.config.redisBackupSchedule,
        compression: backupManager.config.compression
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update strategy',
      error: err.message
    });
  }
});

module.exports = { router, backupManager };
