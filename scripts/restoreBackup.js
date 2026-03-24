/**
 * Restore Database Script
 * Usage: node scripts/restoreBackup.js <backupFileName>
 */

const backupService = require('../services/backup');
const logger = require('../config/logger');

const restoreBackup = async () => {
  const backupFileName = process.argv[2];
  
  if (!backupFileName) {
    console.log('Usage: node scripts/restoreBackup.js <backupFileName>');
    console.log('\nExample: node scripts/restoreBackup.js chukacribs-backup-2026-01-18T10-30-45-123Z.archive');
    process.exit(1);
  }
  
  console.log(`\nRestoring from backup: ${backupFileName}\n`);
  
  const result = await backupService.restoreFromBackup(backupFileName);
  
  if (result.success) {
    console.log('✅ Restore completed successfully!');
  } else {
    console.error('❌ Restore failed:', result.error);
    process.exit(1);
  }
};

restoreBackup();
