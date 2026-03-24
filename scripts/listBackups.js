/**
 * List Backups Script
 * Usage: node scripts/listBackups.js
 */

const backupService = require('../services/backup');

const listBackups = () => {
  const backups = backupService.getBackupList();
  
  if (backups.length === 0) {
    console.log('No backups found.');
    return;
  }
  
  console.log(`\n📦 Found ${backups.length} backup(s):\n`);
  
  backups.forEach((backup, index) => {
    const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
    const created = backup.created.toLocaleString();
    console.log(`${index + 1}. ${backup.fileName}`);
    console.log(`   Size: ${sizeMB} MB | Created: ${created}\n`);
  });
};

listBackups();
