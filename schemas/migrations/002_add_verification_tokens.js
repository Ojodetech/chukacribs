/**
 * Migration: Add Verification Token Fields
 * Description: Adds email verification and password reset token fields to Student model
 * Version: 1.1.0
 * Created: 2026-02-08
 */

const mongoose = require('mongoose');
const logger = require('../../config/logger');

module.exports = {
  version: '1.1.0',
  description: 'Add email verification and password reset fields to Student collection',
  rollbackable: true,
  notes: 'Enables email verification workflow',

  /**
   * Apply migration
   */
  async up() {
    try {
      const studentCollection = mongoose.connection.collection('students');
      
      // Add verification token fields
      const result = await studentCollection.updateMany(
        { emailVerified: { $exists: false } },
        {
          $set: {
            emailVerified: false,
            emailVerificationToken: null,
            emailVerificationExpiry: null,
            passwordResetToken: null,
            passwordResetExpiry: null
          }
        }
      );

      logger.info(
        `Migration 002: Updated ${result.modifiedCount} student documents ` +
        `with verification token fields`
      );

      return true;
    } catch (err) {
      logger.error(`Migration 002 failed: ${err.message}`);
      throw err;
    }
  },

  /**
   * Rollback migration
   */
  async down() {
    try {
      const studentCollection = mongoose.connection.collection('students');
      
      // Remove verification token fields
      const result = await studentCollection.updateMany(
        {},
        {
          $unset: {
            emailVerified: '',
            emailVerificationToken: '',
            emailVerificationExpiry: '',
            passwordResetToken: '',
            passwordResetExpiry: ''
          }
        }
      );

      logger.info(`Migration 002 rollback: Removed verification fields from ${result.modifiedCount} documents`);
      return true;
    } catch (err) {
      logger.error(`Migration 002 rollback failed: ${err.message}`);
      throw err;
    }
  }
};
