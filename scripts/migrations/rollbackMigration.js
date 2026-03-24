#!/usr/bin/env node
/**
 * Rollback Migration
 * Rolls back a previously executed migration
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const migrationRunner = require('../../config/migrations');
const logger = require('../../config/logger');

async function main() {
  const migrationName = process.argv[2];

  if (!migrationName) {
    console.error('Usage: node rollbackMigration.js <migration-name>');
    console.error('Example: node rollbackMigration.js 002_add_verification_tokens');
    process.exit(1);
  }

  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chuka-cribs';
    
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Register Migration model
    require('../../models/Migration');

    console.log('\n' + '='.repeat(60));
    console.log(`Rolling back migration: ${migrationName}`);
    console.log('='.repeat(60));

    const result = await migrationRunner.rollbackMigration(migrationName);

    if (result.success) {
      console.log(`\n✓ Migration rolled back successfully in ${result.duration}ms`);
    } else {
      console.log(`\n✗ Rollback failed: ${result.error}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // Show updated status
    const status = await migrationRunner.getStatus();
    console.log('\nUpdated Migration Status:');
    console.log(`  Completed: ${status.summary.totalCompleted}`);
    console.log(`  Failed: ${status.summary.totalFailed}`);
    console.log(`  Pending: ${status.summary.totalPending}`);

    console.log('\n' + '='.repeat(60));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    logger.error(`Rollback failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();
