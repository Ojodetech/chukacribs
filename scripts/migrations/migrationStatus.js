#!/usr/bin/env node
/**
 * Check Migration Status
 * Displays current migration status and pending migrations
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const migrationRunner = require('../../config/migrations');
const logger = require('../../config/logger');

async function main() {
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

    const status = await migrationRunner.getStatus();

    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION STATUS REPORT');
    console.log('='.repeat(60));

    // Summary
    console.log('\nSummary:');
    console.log(`  Completed: ${status.summary.totalCompleted}`);
    console.log(`  Failed: ${status.summary.totalFailed}`);
    console.log(`  Pending: ${status.summary.totalPending}`);
    console.log(`  Last Batch: ${status.summary.lastBatch}`);

    // Completed migrations
    if (status.completed.length > 0) {
      console.log('\nCompleted Migrations:');
      status.completed.slice(0, 10).forEach(m => {
        console.log(`  ✓ ${m.name} (${m.version})`);
        console.log(`    ${m.duration}ms | Batch: ${m.batch}`);
      });
      if (status.completed.length > 10) {
        console.log(`  ... and ${status.completed.length - 10} more`);
      }
    }

    // Failed migrations
    if (status.failed.length > 0) {
      console.log('\nFailed Migrations:');
      status.failed.forEach(m => {
        console.log(`  ✗ ${m.name} (${m.version})`);
        console.log(`    Error: ${m.error}`);
      });
    }

    // Pending migrations
    if (status.pending.length > 0) {
      console.log('\nPending Migrations:');
      status.pending.forEach(m => {
        console.log(`  ⧖ ${m.name} (${m.version})`);
        console.log(`    ${m.description}`);
      });
    } else {
      console.log('\n✓ All migrations are up to date!');
    }

    // Verify integrity
    console.log('\nVerifying migration integrity...');
    const integrity = await migrationRunner.verifyIntegrity();
    if (integrity.valid) {
      console.log('✓ All migrations are valid');
    } else {
      console.log('✗ Migration integrity issues detected:');
      integrity.issues.forEach(issue => {
        console.log(`  - ${issue.name}: ${issue.issue}`);
      });
    }

    console.log('\n' + '='.repeat(60));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    logger.error(`Status check failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();
