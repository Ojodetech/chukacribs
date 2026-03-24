/**
 * Error Monitoring and Tracking
 * Tracks error rates, patterns, and alerts
 */

const logger = require('../logger');

class ErrorMonitor {
  constructor() {
    this.errors = new Map();
    this.errorRates = new Map();
    this.alertThresholds = {
      errorRatePercentage: 5, // Alert if error rate > 5%
      specificErrorCount: 10, // Alert if error occurs > 10 times in window
      windowSize: 60000 // 1 minute window
    };
  }

  /**
   * Track error occurrence
   */
  trackError(errorCode, errorDetails = {}) {
    const now = Date.now();
    const key = `${errorCode}`;

    if (!this.errors.has(key)) {
      this.errors.set(key, []);
    }

    this.errors.get(key).push({
      timestamp: now,
      ...errorDetails
    });

    // Clean old entries
    this.cleanOldEntries();

    // Check if alert threshold exceeded
    this.checkAlertThresholds();
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeWindowMs = 3600000) {
    const now = Date.now();
    const stats = {
      totalErrors: 0,
      errorsByType: {},
      recentErrors: [],
      topErrors: []
    };

    for (const [errorCode, errors] of this.errors.entries()) {
      const recentErrors = errors.filter(e => now - e.timestamp < timeWindowMs);
      
      if (recentErrors.length > 0) {
        stats.errorsByType[errorCode] = recentErrors.length;
        stats.totalErrors += recentErrors.length;
        stats.recentErrors.push(...recentErrors.slice(-5));
      }
    }

    // Sort by frequency
    stats.topErrors = Object.entries(stats.errorsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([errorCode, count]) => ({ errorCode, count }));

    return stats;
  }

  /**
   * Get error trend
   */
  getErrorTrend(errorCode, intervalMinutes = 1, periods = 60) {
    const now = Date.now();
    const interval = intervalMinutes * 60 * 1000;
    const trend = [];

    if (!this.errors.has(errorCode)) {
      return trend;
    }

    for (let i = periods - 1; i >= 0; i--) {
      const periodStart = now - (i + 1) * interval;
      const periodEnd = now - i * interval;

      const count = this.errors.get(errorCode).filter(
        e => e.timestamp >= periodStart && e.timestamp < periodEnd
      ).length;

      trend.push({
        timestamp: new Date(periodStart).toISOString(),
        count
      });
    }

    return trend;
  }

  /**
   * Clean old error entries
   */
  cleanOldEntries(maxAgeMs = 3600000) {
    const now = Date.now();
    
    for (const [errorCode, errors] of this.errors.entries()) {
      const recentErrors = errors.filter(e => now - e.timestamp < maxAgeMs);
      
      if (recentErrors.length === 0) {
        this.errors.delete(errorCode);
      } else if (recentErrors.length < errors.length) {
        this.errors.set(errorCode, recentErrors);
      }
    }
  }

  /**
   * Check if alert thresholds exceeded
   */
  checkAlertThresholds() {
    const stats = this.getErrorStats(this.alertThresholds.windowSize);
    
    // Check for specific error threshold
    for (const [errorCode, count] of Object.entries(stats.errorsByType)) {
      if (count >= this.alertThresholds.specificErrorCount) {
        this.triggerAlert('SPECIFIC_ERROR_THRESHOLD', {
          errorCode,
          count,
          threshold: this.alertThresholds.specificErrorCount
        });
      }
    }

    // Check error rate
    const totalRequests = this.getTotalRequestCount();
    if (totalRequests > 0) {
      const errorRate = (stats.totalErrors / totalRequests) * 100;
      if (errorRate > this.alertThresholds.errorRatePercentage) {
        this.triggerAlert('ERROR_RATE_THRESHOLD', {
          errorRate: errorRate.toFixed(2),
          threshold: this.alertThresholds.errorRatePercentage
        });
      }
    }
  }

  /**
   * Trigger alert
   */
  triggerAlert(alertType, data) {
    logger.error(`ALERT TRIGGERED: ${alertType}`, data);
    
    // Could integrate with alerting service (Slack, PagerDuty, etc.)
    // Example: this.notifyAlertingService(alertType, data);
  }

  /**
   * Get total request count (simplified - would need request middleware)
   */
  getTotalRequestCount() {
    const stats = this.getErrorStats();
    // This is approximate - in production, track total requests separately
    return Math.max(stats.totalErrors * 20, 1); // Assume ~5% error rate
  }

  /**
   * Reset error tracking
   */
  reset() {
    this.errors.clear();
    this.errorRates.clear();
  }
}

// Singleton instance
const errorMonitor = new ErrorMonitor();

module.exports = errorMonitor;
