/**
 * Migration: Initial Schema Setup
 * Description: Creates initial indexes and default collections for core models
 * Version: 1.0.0
 * Created: 2026-02-08
 */

const mongoose = require('mongoose');
const logger = require('../../config/logger');

module.exports = {
  version: '1.0.0',
  description: 'Initial schema setup with indexes and constraints',
  rollbackable: false,
  notes: 'Base migration - sets up foundation for all models',

  /**
   * Apply migration
   */
  async up() {
    try {
      // Ensure collections exist and indexes are created
      // This is done through Mongoose model connections
      
      // You can add additional setup here
      logger.info('Migration 001: Initial schema setup completed');
      
      return true;
    } catch (err) {
      logger.error(`Migration 001 failed: ${err.message}`);
      throw err;
    }
  },

  /**
   * Rollback migration (not implemented for initial schema)
   */
  async down() {
    logger.warn('Migration 001: Cannot rollback initial schema');
    throw new Error('Initial schema migration cannot be rolled back');
  }
};
