#!/usr/bin/env node
/**
 * Run Migrations
 * Executes all pending migrations in sequence
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

    logger.info('Starting migration runner...');
    const results = await migrationRunner.runPendingMigrations();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION RUN SUMMARY');
    console.log('='.repeat(60));
    
    results.forEach(result => {
      const status = result.success ? '✓' : '✗';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${status} ${result.name}${duration}`);
      
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });

    const successful = results.filter(r => r.success).length;
    console.log('\n' + `Completed: ${successful}/${results.length} migrations`);
    console.log('='.repeat(60));

    // Show current status
    const status = await migrationRunner.getStatus();
    console.log('\nMigration Status:');
    console.log(JSON.stringify(status.summary, null, 2));

    await mongoose.disconnect();
    process.exit(successful === results.length ? 0 : 1);
  } catch (err) {
    logger.error(`Migration runner failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();
