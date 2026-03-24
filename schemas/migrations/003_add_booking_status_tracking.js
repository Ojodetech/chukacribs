/**
 * Migration: Add Booking Status Tracking
 * Description: Adds detailed status tracking fields to Booking model
 * Version: 1.2.0
 * Created: 2026-02-08
 */

const mongoose = require('mongoose');
const logger = require('../../config/logger');

module.exports = {
  version: '1.2.0',
  description: 'Add booking status tracking and payment tracking fields',
  rollbackable: true,
  notes: 'Improves booking workflow management',

  /**
   * Apply migration
   */
  async up() {
    try {
      const bookingCollection = mongoose.connection.collection('bookings');
      
      // Add status tracking fields
      const result = await bookingCollection.updateMany(
        { status: { $exists: true } },
        {
          $set: {
            statusHistory: [],
            paymentStatus: 'pending',
            paymentMethod: null,
            confirmedAt: null,
            cancelledAt: null,
            cancellationReason: null
          }
        }
      );

      // Create status tracking index
      await bookingCollection.createIndex({ status: 1, studentId: 1 });
      await bookingCollection.createIndex({ paymentStatus: 1 });

      logger.info(
        `Migration 003: Updated ${result.modifiedCount} booking documents ` +
        `with status tracking fields`
      );

      return true;
    } catch (err) {
      logger.error(`Migration 003 failed: ${err.message}`);
      throw err;
    }
  },

  /**
   * Rollback migration
   */
  async down() {
    try {
      const bookingCollection = mongoose.connection.collection('bookings');
      
      // Remove status tracking fields
      const result = await bookingCollection.updateMany(
        {},
        {
          $unset: {
            statusHistory: '',
            paymentStatus: '',
            paymentMethod: '',
            confirmedAt: '',
            cancelledAt: '',
            cancellationReason: ''
          }
        }
      );

      logger.info(`Migration 003 rollback: Removed status fields from ${result.modifiedCount} documents`);
      return true;
    } catch (err) {
      logger.error(`Migration 003 rollback failed: ${err.message}`);
      throw err;
    }
  }
};
