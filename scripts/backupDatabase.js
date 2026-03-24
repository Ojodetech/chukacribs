/**
 * Database Backup Script
 * Usage: node scripts/backupDatabase.js
 */

const backupService = require('../services/backup');
const logger = require('../config/logger');

const createBackup = async () => {
  console.log('Starting database backup...\n');
  
  const result = await backupService.backupDatabase();
  
  if (result.success) {
    console.log('✅ Backup completed successfully!');
    console.log(`📦 File: ${result.fileName}`);
    console.log(`📊 Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`⏰ Time: ${result.timestamp}`);
  } else {
    console.error('❌ Backup failed:', result.error);
    process.exit(1);
  }
};

createBackup();
