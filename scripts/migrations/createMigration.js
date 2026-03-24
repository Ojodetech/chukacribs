#!/usr/bin/env node
/**
 * Create Migration
 * Helper to generate a new migration file template
 */

const fs = require('fs');
const path = require('path');

function generateMigration(name) {
  // Validate name
  if (!name || typeof name !== 'string') {
    console.error('Usage: node createMigration.js <migration-name>');
    console.error('Example: node createMigration.js add_user_role_field');
    process.exit(1);
  }

  // Generate timestamp and filename
  const timestamp = String(Date.now()).slice(0, 10); // Unix timestamp prefix
  const paddedNum = String(timestamp).slice(-3); // Last 3 digits
  const filename = `${paddedNum}_${name}.js`;
  const migrationsDir = path.join(__dirname, '../../schemas/migrations');
  const filePath = path.join(migrationsDir, filename);

  // Check if file already exists
  if (fs.existsSync(filePath)) {
    console.error(`Migration file already exists: ${filename}`);
    process.exit(1);
  }

  // Generate migration template
  const template = `/**
 * Migration: ${name.replace(/_/g, ' ')}
 * Description: [Add description here]
 * Version: [X.Y.Z]
 * Created: ${new Date().toISOString().split('T')[0]}
 */

const mongoose = require('mongoose');
const logger = require('../../config/logger');

module.exports = {
  version: '1.0.0',
  description: '[Add detailed description of what this migration does]',
  rollbackable: true,
  notes: '[Optional notes about the migration]',

  /**
   * Apply migration
   */
  async up() {
    try {
      // Write your migration logic here
      // Example: await mongoose.connection.collection('users').updateMany(...)
      
      logger.info('Migration ${filename}: Completed successfully');
      return true;
    } catch (err) {
      logger.error(\`Migration ${filename} failed: \${err.message}\`);
      throw err;
    }
  },

  /**
   * Rollback migration
   */
  async down() {
    try {
      // Write your rollback logic here
      
      logger.info('Migration ${filename}: Rollback completed');
      return true;
    } catch (err) {
      logger.error(\`Migration ${filename} rollback failed: \${err.message}\`);
      throw err;
    }
  }
};
`;

  try {
    fs.writeFileSync(filePath, template, 'utf8');
    console.log(`✓ Migration created: ${filename}`);
    console.log(`  Path: ${filePath}`);
    console.log('\nNext steps:');
    console.log(`  1. Edit the migration file to add your logic`);
    console.log(`  2. Run: npm run migrate`);
  } catch (err) {
    console.error(`Failed to create migration: ${err.message}`);
    process.exit(1);
  }
}

const migrationName = process.argv[2];
generateMigration(migrationName);
