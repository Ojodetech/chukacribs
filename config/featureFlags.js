/**
 * Feature Flags System
 * 
 * Enables gradual feature rollout with:
 * - Percentage-based rollouts (0-100%)
 * - User/segment targeting
 * - A/B testing support
 * - Real-time flag updates
 * - Audit trail for changes
 * 
 * Usage:
 * if (featureFlagManager.isEnabled('newPaymentFlow', req.userId)) {
 *   // Use new feature
 * } else {
 *   // Use old feature
 * }
 */

const eventEmitter = require('events');

/**
 * Feature Flag Manager
 */
class FeatureFlagManager extends eventEmitter.EventEmitter {
  constructor() {
    super();
    this.flags = new Map();
    this.userSegments = new Map();
    this.auditLog = [];
    this.initializeDefaultFlags();
  }

  /**
   * Initialize default flags
   */
  initializeDefaultFlags() {
    const defaults = {
      // Feature rollout examples
      'newPaymentFlow': {
        enabled: true,
        rolloutPercentage: 50, // 50% of users
        description: 'New payment processing flow',
        owner: 'payments-team',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'enhancedSearch': {
        enabled: true,
        rolloutPercentage: 100, // 100% - fully released
        description: 'New search with filters',
        owner: 'search-team',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'advancedAnalytics': {
        enabled: false,
        rolloutPercentage: 0, // Not yet released
        description: 'Advanced property analytics',
        owner: 'analytics-team',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'bulkOperations': {
        enabled: true,
        rolloutPercentage: 25, // Beta: 25% of users
        description: 'Bulk operations for landlords',
        owner: 'backend-team',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'newUIv2': {
        enabled: false,
        rolloutPercentage: 10, // Canary: 10% of users
        description: 'Redesigned user interface',
        owner: 'frontend-team',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    for (const [name, config] of Object.entries(defaults)) {
      this.flags.set(name, config);
    }
  }

  /**
   * Check if feature is enabled for user
   */
  isEnabled(flagName, userId = null, context = {}) {
    const flag = this.flags.get(flagName);
    
    if (!flag) {
      console.warn(`[FeatureFlags] Unknown flag: ${flagName}`);
      return false;
    }

    // Global disable
    if (!flag.enabled) {
      return false;
    }

    // Check user segment override
    if (userId && this.isUserInSegment(userId, flagName)) {
      return true;
    }

    // Percentage-based rollout
    if (userId) {
      const hash = this.hashUser(userId, flagName);
      return hash % 100 < flag.rolloutPercentage;
    }

    // No user ID - return enabled status
    return flag.enabled && flag.rolloutPercentage >= 50;
  }

  /**
   * Hash user for consistent bucket assignment
   */
  hashUser(userId, flagName) {
    const str = `${userId}:${flagName}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Add user to segment (for instant rollout)
   */
  addUserToSegment(userId, flagName) {
    if (!this.userSegments.has(flagName)) {
      this.userSegments.set(flagName, new Set());
    }
    this.userSegments.get(flagName).add(userId);

    this.auditLog.push({
      action: 'addUserToSegment',
      flagName,
      userId,
      timestamp: new Date(),
      changedBy: process.env.USER || 'system'
    });

    this.emit('userSegmentAdded', { userId, flagName });
  }

  /**
   * Remove user from segment
   */
  removeUserFromSegment(userId, flagName) {
    if (this.userSegments.has(flagName)) {
      this.userSegments.get(flagName).delete(userId);
    }

    this.auditLog.push({
      action: 'removeUserFromSegment',
      flagName,
      userId,
      timestamp: new Date(),
      changedBy: process.env.USER || 'system'
    });

    this.emit('userSegmentRemoved', { userId, flagName });
  }

  /**
   * Check if user is in segment
   */
  isUserInSegment(userId, flagName) {
    return this.userSegments.has(flagName) && 
           this.userSegments.get(flagName).has(userId);
  }

  /**
   * Get segment members
   */
  getSegmentMembers(flagName) {
    return this.userSegments.get(flagName) 
      ? Array.from(this.userSegments.get(flagName))
      : [];
  }

  /**
   * Update flag rollout percentage
   */
  updateRolloutPercentage(flagName, percentage) {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Flag not found: ${flagName}`);
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0-100');
    }

    const oldPercentage = flag.rolloutPercentage;
    flag.rolloutPercentage = percentage;
    flag.updatedAt = new Date();

    this.auditLog.push({
      action: 'updateRolloutPercentage',
      flagName,
      oldPercentage,
      newPercentage: percentage,
      timestamp: new Date(),
      changedBy: process.env.USER || 'system'
    });

    this.emit('flagUpdated', { flagName, percentage });
  }

  /**
   * Enable/disable flag
   */
  setFlagEnabled(flagName, enabled) {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Flag not found: ${flagName}`);
    }

    flag.enabled = enabled;
    flag.updatedAt = new Date();

    this.auditLog.push({
      action: enabled ? 'enableFlag' : 'disableFlag',
      flagName,
      timestamp: new Date(),
      changedBy: process.env.USER || 'system'
    });

    this.emit(enabled ? 'flagEnabled' : 'flagDisabled', { flagName });
  }

  /**
   * Create new feature flag
   */
  createFlag(flagName, config) {
    if (this.flags.has(flagName)) {
      throw new Error(`Flag already exists: ${flagName}`);
    }

    const newFlag = {
      enabled: config.enabled || false,
      rolloutPercentage: config.rolloutPercentage || 0,
      description: config.description || '',
      owner: config.owner || 'unassigned',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.flags.set(flagName, newFlag);

    this.auditLog.push({
      action: 'createFlag',
      flagName,
      config: newFlag,
      timestamp: new Date(),
      changedBy: process.env.USER || 'system'
    });

    this.emit('flagCreated', { flagName, config: newFlag });
  }

  /**
   * Get all flags
   */
  getAllFlags() {
    const result = {};
    for (const [name, flag] of this.flags) {
      result[name] = {
        ...flag,
        segmentSize: this.getSegmentMembers(name).length
      };
    }
    return result;
  }

  /**
   * Get flag info
   */
  getFlag(flagName) {
    const flag = this.flags.get(flagName);
    if (!flag) {
      return null;
    }
    return {
      ...flag,
      segmentAudience: this.getSegmentMembers(flagName)
    };
  }

  /**
   * Get audit log
   */
  getAuditLog(flagName = null) {
    if (flagName) {
      return this.auditLog.filter(entry => entry.flagName === flagName);
    }
    return this.auditLog.slice(-100); // Last 100 entries
  }

  /**
   * Get AB test results (simulated)
   */
  getABTestResults(flagName) {
    return {
      flagName,
      enabled: this.flags.get(flagName)?.enabled,
      rolloutPercentage: this.flags.get(flagName)?.rolloutPercentage,
      controlGroup: {
        percentage: 100 - this.flags.get(flagName)?.rolloutPercentage,
        conversionRate: 0.023, // simulated
        avgSessionTime: 245 // seconds, simulated
      },
      treatmentGroup: {
        percentage: this.flags.get(flagName)?.rolloutPercentage,
        conversionRate: 0.031, // simulated
        avgSessionTime: 312 // seconds, simulated
      },
      statisticalSignificance: 0.92, // 92% confident
      recommendation: 'Rollout to 100% - significant improvement'
    };
  }

  /**
   * Gradual rollout strategy
   */
  getGradualRolloutPlan(flagName, targetPercentage = 100, steps = 5) {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Flag not found: ${flagName}`);
    }

    const currentPercentage = flag.rolloutPercentage;
    const incrementPerStep = (targetPercentage - currentPercentage) / steps;
    const plan = [];

    for (let i = 1; i <steps; i++) {
      plan.push({
        step: i,
        targetPercentage: Math.round(currentPercentage + (incrementPerStep * i)),
        durationHours: 24, // 1 day per step
        monitoringMetrics: ['conversion_rate', 'error_rate', 'performance']
      });
    }

    return {
      flagName,
      currentPercentage,
      targetPercentage,
      steps: plan,
      totalDuration: `${steps - 1} days`,
      estimatedCompletion: new Date(Date.now() + (steps - 1) * 24 * 60 * 60 * 1000)
    };
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

const featureFlagManager = new FeatureFlagManager();

module.exports = {
  featureFlagManager,
  FeatureFlagManager
};
