/**
 * Comprehensive Audit Logging Module
 * 
 * Tracks all user actions, system events, security incidents, and compliance-required operations
 * Features:
 * - Immutable audit trail
 * - Real-time alerting for security events
 * - GDPR/HIPAA compliance support
 * - Structured logging for ELK integration
 */

const mongoose = require('mongoose');
const logger = require('./logger');

// Audit Trail Schema - Immutable record of all significant actions
const auditSchema = new mongoose.Schema({
  // Event identification
  eventId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: [
      // User actions
      'USER_LOGIN',
      'USER_LOGOUT',
      'USER_REGISTER',
      'USER_DELETE',
      'USER_PROFILE_UPDATE',
      'USER_PASSWORD_CHANGE',
      'USER_MFA_SETUP',
      'USER_MFA_DISABLE',
      
      // Authentication
      'AUTH_SUCCESS',
      'AUTH_FAILURE',
      'AUTH_INVALID_TOKEN',
      'AUTH_TOKEN_REFRESH',
      'AUTH_SESSION_TIMEOUT',
      
      // Data access
      'DATA_ACCESS',
      'DATA_EXPORT',
      'DATA_IMPORT',
      'DATA_DELETE',
      'DATA_MODIFY',
      
      // Admin actions
      'ADMIN_USER_MANAGE',
      'ADMIN_SETTINGS_CHANGE',
      'ADMIN_ROLE_GRANT',
      'ADMIN_ROLE_REVOKE',
      'ADMIN_PERMISSION_GRANT',
      'ADMIN_PERMISSION_REVOKE',
      
      // Payment actions
      'PAYMENT_INITIATED',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILED',
      'PAYMENT_REFUND',
      'PAYMENT_DISPUTE',
      
      // Security events
      'SECURITY_BREACH_ATTEMPT',
      'SECURITY_SUSPICIOUS_ACTIVITY',
      'SECURITY_RATE_LIMIT_EXCEEDED',
      'SECURITY_INJECTION_ATTEMPT',
      'SECURITY_UNAUTHORIZED_ACCESS',
      'SECURITY_DATA_EXPOSURE_RISK',
      
      // System events
      'SYSTEM_START',
      'SYSTEM_SHUTDOWN',
      'SYSTEM_ERROR',
      'SYSTEM_WARNING',
      'DATABASE_MIGRATION',
      'BACKUP_INITIATED',
      'BACKUP_COMPLETED',
      'RESTORE_INITIATED',
      'RESTORE_COMPLETED'
    ],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
    index: true
  },
  
  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    sparse: true
  },
  username: String,
  userRole: String,
  userEmail: String,
  
  // IP and location
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: String,
  geoLocation: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Action details
  resourceType: String, // 'User', 'House', 'Booking', 'Payment', etc.
  resourceId: {
    type: String,
    index: true,
    sparse: true
  },
  action: String, // 'CREATE', 'READ', 'UPDATE', 'DELETE'
  
  // Change tracking
  changesBefore: mongoose.Schema.Types.Mixed,
  changesAfter: mongoose.Schema.Types.Mixed,
  changedFields: [String],
  
  // Request/Response details
  httpMethod: String,
  endpoint: String,
  queryParams: mongoose.Schema.Types.Mixed,
  requestBody: mongoose.Schema.Types.Mixed,
  responseStatus: Number,
  responseTime: Number, // milliseconds
  
  // Result information
  success: Boolean,
  errorMessage: String,
  errorCode: String,
  
  // Compliance fields
  dataClassification: {
    type: String,
    enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
    default: 'INTERNAL'
  },
  consentType: String, // For GDPR
  consentGiven: Boolean,
  
  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    // Make this immutable
    immutable: true
  },
  
  // Metadata
  sessionId: String,
  requestId: {
    type: String,
    unique: true,
    sparse: true
  },
  correlationId: String, // For tracing distributed requests
  tags: [String], // For categorization
  
  // Immutability marker
  _immutable: {
    type: Boolean,
    default: true,
    immutable: true
  }
}, {
  strict: false,
  timestamps: false
});

// Ensure no updates to already created audits (immutable design)
auditSchema.pre('updateOne', function() {
  throw new Error('Audit records are immutable and cannot be updated');
});

auditSchema.pre('findByIdAndUpdate', function() {
  throw new Error('Audit records are immutable and cannot be updated');
});

auditSchema.pre('updateMany', function() {
  throw new Error('Audit records are immutable and cannot be updated');
});

// Create indexes for efficient querying
auditSchema.index({ userId: 1, timestamp: -1 });
auditSchema.index({ eventType: 1, timestamp: -1 });
auditSchema.index({ severity: 1, timestamp: -1 });
auditSchema.index({ resourceType: 1, resourceId: 1 });
auditSchema.index({ timestamp: -1 });
auditSchema.index({ ipAddress: 1, timestamp: -1 });

const Audit = mongoose.model('Audit', auditSchema);

/**
 * AuditLogger - Central logging service
 * Usage: auditLogger.logEvent(event)
 */
class AuditLogger {
  constructor() {
    this.securityAlerts = [];
    this.thresholds = {
      failedAuthAttempts: 5,
      rateLimitExceeded: 100,
      suspiciousActivity: 3
    };
  }
  
  /**
   * Create an audit log entry
   */
  async logEvent(eventData) {
    try {
      // Generate event ID
      const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Sanitize sensitive data before logging
      const sanitizedData = this._sanitizeData(eventData);
      
      // Create audit record
      const audit = new Audit({
        eventId,
        ...sanitizedData,
        timestamp: new Date()
      });
      
      // Save to database
      await audit.save();
      
      // Log to structured logger
      logger.info(`Audit: ${eventData.eventType}`, {
        eventId,
        userId: eventData.userId,
        eventType: eventData.eventType,
        severity: eventData.severity,
        resourceType: eventData.resourceType
      });
      
      // Check for security alerts
      if (eventData.severity === 'CRITICAL' || eventData.severity === 'HIGH') {
        await this._triggerSecurityAlert(audit);
      }
      
      return audit;
    } catch (error) {
      logger.error('Failed to log audit event', error);
      // Don't throw - continue operation but log failure
    }
  }
  
  /**
   * Log user operation
   */
  async logUserAction(userId, action, resourceType, resourceId, before, after, req) {
    const changedFields = this._getChangedFields(before, after);
    
    return this.logEvent({
      eventType: `USER_${action}`,
      userId,
      username: req?.user?.username,
      userEmail: req?.user?.email,
      resourceType,
      resourceId,
      action,
      changesBefore: before,
      changesAfter: after,
      changedFields,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.headers['user-agent'],
      httpMethod: req?.method,
      endpoint: req?.originalUrl,
      severity: action === 'DELETE' ? 'HIGH' : 'MEDIUM',
      success: true,
      requestId: req?.id
    });
  }
  
  /**
   * Log authentication event
   */
  async logAuthEvent(eventType, userId, success, reason, req) {
    const severity = success ? 'LOW' : 'HIGH';
    
    const audit = await this.logEvent({
      eventType,
      userId,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.headers['user-agent'],
      httpMethod: req?.method,
      endpoint: req?.originalUrl,
      success,
      errorMessage: reason,
      severity,
      requestId: req?.id
    });
    
    // Track failed attempts
    if (!success) {
      await this._trackFailedAttempt(req?.ip);
    }
    
    return audit;
  }
  
  /**
   * Log security event
   */
  async logSecurityEvent(eventType, severity, description, userId, req, details = {}) {
    return this.logEvent({
      eventType,
      severity,
      userId,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.headers['user-agent'],
      errorMessage: description,
      httpMethod: req?.method,
      endpoint: req?.originalUrl,
      queryParams: req?.query,
      requestId: req?.id,
      ...details
    });
  }
  
  /**
   * Log payment event
   */
  async logPaymentEvent(eventType, paymentId, amount, userId, status, req) {
    return this.logEvent({
      eventType,
      severity: ['PAYMENT_FAILED', 'PAYMENT_DISPUTE'].includes(eventType) ? 'HIGH' : 'MEDIUM',
      userId,
      resourceType: 'Payment',
      resourceId: paymentId,
      httpMethod: req?.method,
      endpoint: req?.originalUrl,
      ipAddress: req?.ip || 'unknown',
      success: ['PAYMENT_SUCCESS', 'PAYMENT_REFUND'].includes(eventType),
      requestBody: { amount, status },
      requestId: req?.id
    });
  }
  
  /**
   * Log data access (for compliance audits)
   */
  async logDataAccess(userId, dataType, action, count, req) {
    return this.logEvent({
      eventType: 'DATA_ACCESS',
      userId,
      resourceType: dataType,
      action,
      ipAddress: req?.ip || 'unknown',
      httpMethod: req?.method,
      endpoint: req?.originalUrl,
      queryParams: req?.query,
      severity: 'LOW',
      success: true,
      requestId: req?.id,
      dataClassification: 'CONFIDENTIAL' // Data access is always confidential
    });
  }
  
  /**
   * Export audit trail for compliance (e.g., GDPR Data Subject Access Request)
   */
  async exportUserAudit(userId, startDate, endDate) {
    const audits = await Audit.find({
      userId,
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ timestamp: -1 });
    
    return {
      userId,
      exportDate: new Date(),
      recordCount: audits.length,
      records: audits
    };
  }
  
  /**
   * Search audit logs
   */
  async searchAudits(filters = {}) {
    const {
      userId,
      eventType,
      severity,
      startDate,
      endDate,
      ipAddress,
      limit = 100,
      skip = 0
    } = filters;
    
    const query = {};
    
    if (userId) query.userId = userId;
    if (eventType) query.eventType = eventType;
    if (severity) query.severity = severity;
    if (ipAddress) query.ipAddress = ipAddress;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }
    
    const [records, total] = await Promise.all([
      Audit.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip),
      Audit.countDocuments(query)
    ]);
    
    return { records, total, limit, skip };
  }
  
  /**
   * Get audit statistics
   */
  async getStatistics(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stats = await Audit.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $facet: {
          byEventType: [
            {
              $group: {
                _id: '$eventType',
                count: { $sum: 1 }
              }
            },
            {
              $sort: { count: -1 }
            }
          ],
          bySeverity: [
            {
              $group: {
                _id: '$severity',
                count: { $sum: 1 }
              }
            }
          ],
          securityEvents: [
            {
              $match: {
                eventType: { $regex: 'SECURITY' }
              }
            },
            {
              $group: {
                _id: '$eventType',
                count: { $sum: 1 }
              }
            }
          ],
          failedOperations: [
            {
              $match: { success: false }
            },
            {
              $group: {
                _id: '$errorCode',
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);
    
    return stats[0];
  }
  
  /**
   * Private: Sanitize sensitive data
   */
  _sanitizeData(data) {
    const sanitized = { ...data };
    
    // Remove sensitive fields
    if (sanitized.requestBody) {
      sanitized.requestBody = { ...sanitized.requestBody };
      delete sanitized.requestBody.password;
      delete sanitized.requestBody.creditCard;
      delete sanitized.requestBody.token;
      delete sanitized.requestBody.apiKey;
    }
    
    if (sanitized.changesBefore) {
      sanitized.changesBefore = { ...sanitized.changesBefore };
      delete sanitized.changesBefore.password;
    }
    
    if (sanitized.changesAfter) {
      sanitized.changesAfter = { ...sanitized.changesAfter };
      delete sanitized.changesAfter.password;
    }
    
    return sanitized;
  }
  
  /**
   * Private: Get list of changed fields
   */
  _getChangedFields(before, after) {
    if (!before || !after) return [];
    
    return Object.keys(after).filter(key => {
      return JSON.stringify(before[key]) !== JSON.stringify(after[key]);
    });
  }
  
  /**
   * Private: Trigger security alert
   */
  async _triggerSecurityAlert(audit) {
    try {
      // Log to security monitoring system
      logger.error('SECURITY ALERT', {
        eventId: audit.eventId,
        eventType: audit.eventType,
        severity: audit.severity,
        userId: audit.userId,
        ipAddress: audit.ipAddress
      });
      
      // Send to external security service if configured
      if (process.env.SECURITY_WEBHOOK_URL) {
        await fetch(process.env.SECURITY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alert: audit.eventType,
            severity: audit.severity,
            userId: audit.userId,
            timestamp: audit.timestamp
          })
        }).catch(err => logger.error('Failed to send security webhook', err));
      }
    } catch (error) {
      logger.error('Failed to trigger security alert', error);
    }
  }
  
  /**
   * Private: Track failed authentication attempts
   */
  async _trackFailedAttempt(ipAddress) {
    if (!ipAddress) return;
    
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    const failedCount = await Audit.countDocuments({
      ipAddress,
      eventType: 'AUTH_FAILURE',
      timestamp: { $gte: oneHourAgo }
    });
    
    if (failedCount >= this.thresholds.failedAuthAttempts) {
      await this.logSecurityEvent(
        'SECURITY_RATE_LIMIT_EXCEEDED',
        'HIGH',
        `Multiple failed auth attempts from IP: ${ipAddress}`,
        null,
        { ip: ipAddress }
      );
    }
  }
}

module.exports = new AuditLogger();
