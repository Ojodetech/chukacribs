/**
 * Backup Manager
 * Handles automated backups for MongoDB and Redis with retention policies
 * Supports local backups, S3 uploads, and recovery procedures
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const cron = require('node-cron');
const mongoose = require('mongoose');
const redis = require('redis');

const execAsync = promisify(exec);

class BackupManager {
  constructor(config = {}) {
    this.config = {
      backupDir: config.backupDir || path.join(process.cwd(), 'backups'),
      mongoUri: config.mongoUri || process.env.MONGODB_URI,
      redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      s3Enabled: config.s3Enabled || false,
      s3Config: config.s3Config || {}, // { bucket, region, accessKeyId, secretAccessKey }
      retentionDays: config.retentionDays || 30,
      mongoBackupSchedule: config.mongoBackupSchedule || '0 2 * * *', // Daily at 2 AM
      redisBackupSchedule: config.redisBackupSchedule || '0 3 * * *', // Daily at 3 AM
      compression: config.compression !== false, // Default: enabled
      ...config
    };

    this.backupStats = {
      lastMongoBackup: null,
      lastRedisBackup: null,
      totalBackups: 0,
      failedBackups: 0,
      totalSize: 0
    };

    this.tasks = {};
    this._initializeBackupDir();
  }

  /**
   * Initialize backup directory
   */
  _initializeBackupDir() {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
      console.log(`✅ Backup directory created: ${this.config.backupDir}`);
    }
  }

  /**
   * Schedule automated backups
   */
  scheduleBackups() {
    try {
      // MongoDB backup schedule
      this.tasks.mongo = cron.schedule(this.config.mongoBackupSchedule, async () => {
        console.log('⏰ Running scheduled MongoDB backup...');
        try {
          await this.backupMongoDB();
        } catch (err) {
          console.error('❌ Scheduled MongoDB backup failed:', err.message);
          this.backupStats.failedBackups++;
        }
      });

      // Redis backup schedule
      this.tasks.redis = cron.schedule(this.config.redisBackupSchedule, async () => {
        console.log('⏰ Running scheduled Redis backup...');
        try {
          await this.backupRedis();
        } catch (err) {
          console.error('❌ Scheduled Redis backup failed:', err.message);
          this.backupStats.failedBackups++;
        }
      });

      // Cleanup old backups schedule (weekly)
      this.tasks.cleanup = cron.schedule('0 4 * * 0', async () => {
        console.log('🧹 Running backup cleanup...');
        try {
          await this.cleanupOldBackups();
        } catch (err) {
          console.error('❌ Backup cleanup failed:', err.message);
        }
      });

      console.log('✅ Backup schedules initialized');
      console.log(`   MongoDB: ${this.config.mongoBackupSchedule}`);
      console.log(`   Redis: ${this.config.redisBackupSchedule}`);
      console.log(`   Cleanup: Weekly`);
    } catch (err) {
      console.error('❌ Failed to schedule backups:', err.message);
    }
  }

  /**
   * Backup MongoDB database
   */
  async backupMongoDB() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `mongodb-backup-${timestamp}`;
    const backupPath = path.join(this.config.backupDir, backupName);

    try {
      // Extract connection details from MongoDB URI
      const mongoUrl = new URL(this.config.mongoUri);
      const dbName = mongoUrl.pathname.split('/')[1] || 'chukacribs';

      // Create backup directory
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }

      // Run mongodump command
      const mongoCmd = `mongodump --uri="${this.config.mongoUri}" --out="${backupPath}"`;
      
      console.log(`📦 Dumping MongoDB to ${backupPath}...`);
      await execAsync(mongoCmd);

      // Calculate backup size
      const size = this._getDirectorySize(backupPath);
      console.log(`✅ MongoDB backup completed: ${(size / 1024 / 1024).toFixed(2)} MB`);

      // Compress if enabled
      if (this.config.compression) {
        await this._compressBackup(backupPath);
      }

      // Upload to S3 if enabled
      if (this.config.s3Enabled) {
        await this._uploadToS3(backupPath, backupName);
      }

      this.backupStats.lastMongoBackup = new Date();
      this.backupStats.totalBackups++;
      this.backupStats.totalSize += size;

      return {
        success: true,
        name: backupName,
        path: backupPath,
        size: size,
        timestamp: new Date()
      };
    } catch (err) {
      console.error(`❌ MongoDB backup failed: ${err.message}`);
      this.backupStats.failedBackups++;
      throw err;
    }
  }

  /**
   * Backup Redis database
   */
  async backupRedis() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `redis-backup-${timestamp}.rdb`;
    const backupPath = path.join(this.config.backupDir, backupName);

    try {
      console.log(`📦 Backing up Redis to ${backupPath}...`);

      // Connect to Redis
      const client = redis.createClient({
        url: this.config.redisUrl,
        socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 500) }
      });

      await client.connect();

      // Trigger Redis BGSAVE (background save)
      await client.bgSave();
      console.log('✅ Redis BGSAVE triggered');

      // Wait for save to complete (check with LASTSAVE)
      let lastSave = await client.lastSave();
      let originalLastSave = lastSave;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max wait

      while (lastSave === originalLastSave && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        lastSave = await client.lastSave();
        attempts++;
      }

      if (lastSave === originalLastSave) {
        throw new Error('Redis BGSAVE timeout');
      }

      // Get Redis dump file location (typically /var/lib/redis/dump.rdb in production)
      const configReply = await client.configGet('dir');
      const redisDir = configReply[1]; // dir value
      const redisDumpPath = path.join(redisDir, 'dump.rdb');

      // Copy dump file to backup location
      if (fs.existsSync(redisDumpPath)) {
        fs.copyFileSync(redisDumpPath, backupPath);
        const size = fs.statSync(backupPath).size;
        console.log(`✅ Redis backup completed: ${(size / 1024).toFixed(2)} KB`);

        // Compress if enabled
        if (this.config.compression) {
          await this._compressBackup(backupPath);
        }

        // Upload to S3 if enabled
        if (this.config.s3Enabled) {
          await this._uploadToS3(backupPath, backupName);
        }

        this.backupStats.lastRedisBackup = new Date();
        this.backupStats.totalBackups++;
        this.backupStats.totalSize += size;
      } else {
        throw new Error(`Redis dump file not found at ${redisDumpPath}`);
      }

      await client.quit();

      return {
        success: true,
        name: backupName,
        path: backupPath,
        size: fs.statSync(backupPath).size,
        timestamp: new Date()
      };
    } catch (err) {
      console.error(`❌ Redis backup failed: ${err.message}`);
      this.backupStats.failedBackups++;
      throw err;
    }
  }

  /**
   * Restore MongoDB from backup
   */
  async restoreMongoDB(backupPath) {
    try {
      console.log(`🔄 Restoring MongoDB from ${backupPath}...`);

      // Extract backup if compressed
      let actualPath = backupPath;
      if (backupPath.endsWith('.tar.gz') || backupPath.endsWith('.zip')) {
        actualPath = await this._decompressBackup(backupPath);
      }

      // Run mongorestore command
      const mongoRestoreCmd = `mongorestore --uri="${this.config.mongoUri}" --dir="${actualPath}" --drop`;
      await execAsync(mongoRestoreCmd);

      console.log('✅ MongoDB restore completed');
      return {
        success: true,
        restoredFrom: backupPath,
        timestamp: new Date()
      };
    } catch (err) {
      console.error(`❌ MongoDB restore failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Restore Redis from backup
   */
  async restoreRedis(backupPath, redisDumpDir = '/var/lib/redis') {
    try {
      console.log(`🔄 Restoring Redis from ${backupPath}...`);

      // Extract backup if compressed
      let actualPath = backupPath;
      if (backupPath.endsWith('.tar.gz') || backupPath.endsWith('.zip')) {
        actualPath = await this._decompressBackup(backupPath);
      }

      // Connection to Redis
      const client = redis.createClient({
        url: this.config.redisUrl,
        socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 500) }
      });

      await client.connect();

      // Flush existing data (use FLUSHDB for selected DB or FLUSHALL for all)
      await client.flushDB();
      console.log('📭 Redis flushed (preparation for restore)');

      // Copy dump file to Redis directory
      const targetDumpPath = path.join(redisDumpDir, 'dump.rdb');
      fs.copyFileSync(actualPath, targetDumpPath);

      // Shutdown Redis to trigger reload of dump
      // Note: In production, use a graceful shutdown approach
      console.log('⚠️  Redis requires shutdown to reload dump.rdb');
      console.log(`   Copy ${actualPath} to ${targetDumpPath} and restart Redis`);

      await client.quit();

      return {
        success: true,
        restoredFrom: backupPath,
        dumpLocation: targetDumpPath,
        note: 'Redis requires restart to load the dump file',
        timestamp: new Date()
      };
    } catch (err) {
      console.error(`❌ Redis restore failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * List all available backups
   */
  listBackups(filter = null) {
    try {
      const backups = fs.readdirSync(this.config.backupDir)
        .map(name => {
          const fullPath = path.join(this.config.backupDir, name);
          const stat = fs.statSync(fullPath);
          return {
            name,
            path: fullPath,
            size: stat.size,
            type: name.includes('mongodb') ? 'mongodb' : name.includes('redis') ? 'redis' : 'unknown',
            created: stat.birthtime,
            modified: stat.mtime
          };
        })
        .sort((a, b) => b.modified - a.modified);

      // Filter if specified
      if (filter) {
        return backups.filter(b => b.type === filter);
      }

      return backups;
    } catch (err) {
      console.error('❌ Failed to list backups:', err.message);
      return [];
    }
  }

  /**
   * Get backup statistics
   */
  getStatistics() {
    const backups = this.listBackups();
    return {
      ...this.backupStats,
      totalBackupCount: backups.length,
      mongoBackupCount: backups.filter(b => b.type === 'mongodb').length,
      redisBackupCount: backups.filter(b => b.type === 'redis').length,
      diskUsage: backups.reduce((sum, b) => sum + b.size, 0),
      oldestBackup: backups[backups.length - 1]?.created || null,
      newestBackup: backups[0]?.created || null
    };
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups() {
    try {
      const backups = this.listBackups();
      const retentionCutoff = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);

      let deletedCount = 0;
      let freedSpace = 0;

      for (const backup of backups) {
        if (backup.modified < retentionCutoff) {
          try {
            if (fs.lstatSync(backup.path).isDirectory()) {
              fs.rmSync(backup.path, { recursive: true });
            } else {
              fs.unlinkSync(backup.path);
            }
            deletedCount++;
            freedSpace += backup.size;
            console.log(`🗑️  Deleted old backup: ${backup.name}`);
          } catch (err) {
            console.error(`⚠️  Failed to delete ${backup.name}: ${err.message}`);
          }
        }
      }

      console.log(`✅ Cleanup complete: Deleted ${deletedCount} backups, freed ${(freedSpace / 1024 / 1024).toFixed(2)} MB`);
      return { deletedCount, freedSpace };
    } catch (err) {
      console.error('❌ Cleanup failed:', err.message);
      throw err;
    }
  }

  /**
   * Compress backup directory or file
   */
  async _compressBackup(backupPath) {
    try {
      const { createGzip } = require('zlib');
      const tar = require('tar');

      const outputPath = `${backupPath}.tar.gz`;
      
      await new Promise((resolve, reject) => {
        const pipeline = require('stream').pipeline;
        const tarStream = tar.c({ gzip: true }, [backupPath], { 
          cwd: path.dirname(backupPath) 
        });
        const writeStream = fs.createWriteStream(outputPath);

        pipeline(tarStream, writeStream, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const originalSize = this._getDirectorySize(backupPath);
      const compressedSize = fs.statSync(outputPath).size;
      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

      console.log(`📦 Compressed: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${ratio}% reduction)`);

      // Remove uncompressed backup
      fs.rmSync(backupPath, { recursive: true });

      return outputPath;
    } catch (err) {
      console.warn(`⚠️  Compression failed: ${err.message}`);
      return backupPath;
    }
  }

  /**
   * Decompress backup
   */
  async _decompressBackup(backupPath) {
    try {
      const tar = require('tar');
      const outputDir = backupPath.replace(/\.(tar\.gz|zip)$/, '');

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      await tar.x({ file: backupPath, cwd: outputDir });

      console.log(`📦 Decompressed: ${backupPath} → ${outputDir}`);
      return outputDir;
    } catch (err) {
      console.error(`❌ Decompression failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Upload backup to S3
   */
  async _uploadToS3(backupPath, backupName) {
    if (!this.config.s3Enabled || !this.config.s3Config.bucket) {
      return;
    }

    try {
      const AWS = require('aws-sdk');
      const s3 = new AWS.S3(this.config.s3Config);
      const fileContent = fs.readFileSync(backupPath);

      const params = {
        Bucket: this.config.s3Config.bucket,
        Key: `backups/${backupName}`,
        Body: fileContent,
        ContentType: 'application/gzip',
        ServerSideEncryption: 'AES256'
      };

      console.log(`☁️  Uploading to S3: s3://${params.Bucket}/${params.Key}...`);
      await s3.upload(params).promise();
      console.log('✅ S3 upload completed');

      return { bucket: this.config.s3Config.bucket, key: params.Key };
    } catch (err) {
      console.error(`❌ S3 upload failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Calculate directory size
   */
  _getDirectorySize(dirPath) {
    let size = 0;

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        size += this._getDirectorySize(filePath);
      } else {
        size += stat.size;
      }
    }

    return size;
  }

  /**
   * Stop all scheduled backup tasks
   */
  stopSchedules() {
    try {
      Object.values(this.tasks).forEach(task => {
        if (task && typeof task.stop === 'function') {
          task.stop();
        }
      });
      console.log('✅ All backup schedules stopped');
    } catch (err) {
      console.error('❌ Failed to stop schedules:', err.message);
    }
  }
}

module.exports = BackupManager;
