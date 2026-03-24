/**
 * Auto-Scaling Configuration (#10: Horizontal Scaling)
 * Manages dynamic instance scaling based on CPU, memory, and request metrics
 */

class AutoScaler {
  constructor(options = {}) {
    this.minInstances = options.minInstances || 2;
    this.maxInstances = options.maxInstances || 10;
    this.currentInstances = this.minInstances;
    
    // Scaling thresholds
    this.scaleUpThreshold = {
      cpuUsage: options.scaleCpuUpThreshold || 70, // %
      memoryUsage: options.scaleMemUpThreshold || 75, // %
      requestRate: options.scaleReqUpThreshold || 1000, // req/min
      responseTime: options.scaleRespUpThreshold || 1000 // ms
    };

    this.scaleDownThreshold = {
      cpuUsage: options.scaleCpuDownThreshold || 30, // %
      memoryUsage: options.scaleMemDownThreshold || 40, // %
      requestRate: options.scaleReqDownThreshold || 100, // req/min
      responseTime: options.scaleRespDownThreshold || 300 // ms
    };

    this.cooldownPeriod = options.cooldownPeriod || 60000; // 1 minute
    this.lastScalingAction = null;
    this.metrics = [];
    this.callbacks = {
      scaleUp: options.onScaleUp || (() => {}),
      scaleDown: options.onScaleDown || (() => {})
    };

    this.startMonitoring();
  }

  /**
   * Record metrics from running instances
   */
  recordMetrics(instances) {
    const metrics = {
      timestamp: Date.now(),
      instances: instances.length,
      avgCpuUsage: this.calculateAverage(instances.map(i => i.cpuUsage || 0)),
      avgMemoryUsage: this.calculateAverage(instances.map(i => i.memoryUsage || 0)),
      avgResponseTime: this.calculateAverage(instances.map(i => i.responseTime || 0)),
      totalRequests: instances.reduce((sum, i) => sum + (i.totalRequests || 0), 0),
      totalActiveConnections: instances.reduce((sum, i) => sum + (i.activeConnections || 0), 0)
    };

    this.metrics.push(metrics);
    
    // Keep last 60 minutes of metrics
    const oneHourAgo = Date.now() - 3600000;
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

    return metrics;
  }

  /**
   * Evaluate scaling decisions based on current metrics
   */
  evaluateScaling(instances) {
    if (this.isInCooldown()) {
      return null;
    }

    const metrics = this.recordMetrics(instances);
    const decision = this.makeScalingDecision(metrics);

    if (decision === 'SCALE_UP') {
      this.scaleUp();
    } else if (decision === 'SCALE_DOWN') {
      this.scaleDown();
    }

    return decision;
  }

  /**
   * Make scaling decision based on metrics
   */
  makeScalingDecision(metrics) {
    const scaleUpConditions = [
      metrics.avgCpuUsage > this.scaleUpThreshold.cpuUsage,
      metrics.avgMemoryUsage > this.scaleUpThreshold.memoryUsage,
      this.getRequestsPerMinute() > this.scaleUpThreshold.requestRate,
      metrics.avgResponseTime > this.scaleUpThreshold.responseTime
    ];

    const scaleDownConditions = [
      metrics.avgCpuUsage < this.scaleDownThreshold.cpuUsage,
      metrics.avgMemoryUsage < this.scaleDownThreshold.memoryUsage,
      this.getRequestsPerMinute() < this.scaleDownThreshold.requestRate,
      metrics.avgResponseTime < this.scaleDownThreshold.responseTime
    ];

    // Scale up if 2+ conditions met
    if (scaleUpConditions.filter(c => c).length >= 2) {
      return 'SCALE_UP';
    }

    // Scale down if all 4 conditions met
    if (scaleDownConditions.every(c => c)) {
      return 'SCALE_DOWN';
    }

    return null;
  }

  /**
   * Scale up by spawning new instance
   */
  scaleUp() {
    if (this.currentInstances < this.maxInstances) {
      this.currentInstances++;
      this.lastScalingAction = Date.now();
      this.callbacks.scaleUp(this.currentInstances);
      return {
        action: 'SCALE_UP',
        newInstanceCount: this.currentInstances,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Scale down by terminating least busy instance
   */
  scaleDown() {
    if (this.currentInstances > this.minInstances) {
      this.currentInstances--;
      this.lastScalingAction = Date.now();
      this.callbacks.scaleDown(this.currentInstances);
      return {
        action: 'SCALE_DOWN',
        newInstanceCount: this.currentInstances,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get requests per minute from recent metrics
   */
  getRequestsPerMinute() {
    const oneMinuteAgo = Date.now() - 60000;
    const recentMetrics = this.metrics.filter(m => m.timestamp > oneMinuteAgo);
    
    if (recentMetrics.length === 0) return 0;
    
    return recentMetrics[recentMetrics.length - 1].totalRequests / 
           (recentMetrics.length / 10); // Assuming metrics every ~6 seconds
  }

  /**
   * Check if we're in cooldown period
   */
  isInCooldown() {
    if (!this.lastScalingAction) return false;
    return (Date.now() - this.lastScalingAction) < this.cooldownPeriod;
  }

  /**
   * Calculate average of array
   */
  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      // This will be called by the main application
    }, 10000); // Every 10 seconds
  }

  /**
   * Get scaling statistics
   */
  getStats() {
    const latestMetrics = this.metrics[this.metrics.length - 1] || {};
    return {
      currentInstances: this.currentInstances,
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
      lastScalingAction: this.lastScalingAction ? new Date(this.lastScalingAction).toISOString() : null,
      inCooldown: this.isInCooldown(),
      metrics: {
        avgCpuUsage: `${latestMetrics.avgCpuUsage?.toFixed(2)}%`,
        avgMemoryUsage: `${latestMetrics.avgMemoryUsage?.toFixed(2)}%`,
        avgResponseTime: `${latestMetrics.avgResponseTime?.toFixed(2)}ms`,
        requestsPerMinute: `${this.getRequestsPerMinute().toFixed(2)}`
      },
      thresholds: {
        scaleUp: this.scaleUpThreshold,
        scaleDown: this.scaleDownThreshold
      }
    };
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

module.exports = AutoScaler;
