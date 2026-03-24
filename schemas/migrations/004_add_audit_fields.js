/**
 * Migration: Add Audit Fields
 * Description: Adds audit trail fields (createdBy, updatedBy) to all collections
 * Version: 1.3.0
 * Created: 2026-02-08
 */

const mongoose = require('mongoose');
const logger = require('../../config/logger');

module.exports = {
  version: '1.3.0',
  description: 'Add audit trail fields to collections for better tracking',
  rollbackable: true,
  notes: 'Enables audit logging and change tracking',

  /**
   * Apply migration
   */
  async up() {
    try {
      const db = mongoose.connection;
      const collections = ['students', 'houses', 'bookings', 'payments', 'reviews'];
      let totalUpdated = 0;

      for (const collectionName of collections) {
        try {
          const collection = db.collection(collectionName);
          
          const result = await collection.updateMany(
            { createdBy: { $exists: false } },
            {
              $set: {
                createdBy: 'system',
                updatedBy: 'system',
                lastModifiedBy: 'system'
              }
            }
          );

          totalUpdated += result.modifiedCount;
          logger.info(`Migration 004: Updated ${result.modifiedCount} documents in ${collectionName}`);
        } catch (err) {
          logger.warn(`Migration 004: Could not update ${collectionName}: ${err.message}`);
        }
      }

      logger.info(`Migration 004: Total documents updated: ${totalUpdated}`);
      return true;
    } catch (err) {
      logger.error(`Migration 004 failed: ${err.message}`);
      throw err;
    }
  },

  /**
   * Rollback migration
   */
  async down() {
    try {
      const db = mongoose.connection;
      const collections = ['students', 'houses', 'bookings', 'payments', 'reviews'];
      let totalUpdated = 0;

      for (const collectionName of collections) {
        try {
          const collection = db.collection(collectionName);
          
          const result = await collection.updateMany(
            {},
            {
              $unset: {
                createdBy: '',
                updatedBy: '',
                lastModifiedBy: ''
              }
            }
          );

          totalUpdated += result.modifiedCount;
        } catch (err) {
          logger.warn(`Migration 004 rollback: Could not update ${collectionName}`);
        }
      }

      logger.info(`Migration 004 rollback: Total documents updated: ${totalUpdated}`);
      return true;
    } catch (err) {
      logger.error(`Migration 004 rollback failed: ${err.message}`);
      throw err;
    }
  }
};
