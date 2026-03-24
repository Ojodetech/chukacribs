/**
 * Migration: Add Payment Tracking Fields
 * Description: Enhances payment tracking with additional metadata
 * Version: 1.4.0
 * Created: 2026-02-08
 */

const mongoose = require('mongoose');
const logger = require('../../config/logger');

module.exports = {
  version: '1.4.0',
  description: 'Add payment tracking and reconciliation fields',
  rollbackable: true,
  notes: 'Improves payment processing and reconciliation',

  /**
   * Apply migration
   */
  async up() {
    try {
      const paymentCollection = mongoose.connection.collection('payments');
      
      // Add payment tracking fields
      const result = await paymentCollection.updateMany(
        { transactionId: { $exists: true } },
        {
          $set: {
            referenceNumber: null,
            reconciled: false,
            reconciledAt: null,
            accountingEntryId: null,
            metadata: {},
            failureReason: null,
            retryCount: 0
          }
        }
      );

      // Create indexes for payment tracking
      await paymentCollection.createIndex({ referenceNumber: 1 });
      await paymentCollection.createIndex({ reconciled: 1, reconciledAt: -1 });
      await paymentCollection.createIndex({ status: 1, createdAt: -1 });

      logger.info(
        `Migration 005: Updated ${result.modifiedCount} payment documents ` +
        `with tracking fields`
      );

      return true;
    } catch (err) {
      logger.error(`Migration 005 failed: ${err.message}`);
      throw err;
    }
  },

  /**
   * Rollback migration
   */
  async down() {
    try {
      const paymentCollection = mongoose.connection.collection('payments');
      
      // Remove payment tracking fields
      const result = await paymentCollection.updateMany(
        {},
        {
          $unset: {
            referenceNumber: '',
            reconciled: '',
            reconciledAt: '',
            accountingEntryId: '',
            metadata: '',
            failureReason: '',
            retryCount: ''
          }
        }
      );

      logger.info(`Migration 005 rollback: Removed payment fields from ${result.modifiedCount} documents`);
      return true;
    } catch (err) {
      logger.error(`Migration 005 rollback failed: ${err.message}`);
      throw err;
    }
  }
};
