/**
 * MongoDB Connection Pool Monitor
 * Tracks connection pool health, usage patterns, and performance metrics
 * Integrates with Prometheus metrics collector for monitoring
 */

const mongoose = require('mongoose');

class ConnectionPoolMonitor {
  constructor(metricsCollector = null) {
    this.metrics = metricsCollector;
    this.poolStats = {
      poolSize: 0,
      availableConnections: 0,
      waitQueueSize: 0,
      connectionErrors: 0,
      reconnects: 0,
      totalConnections: 0,
      poolHealth: 'unknown'
    };
    this.thresholds = {
      warningPoolUsage: 0.8,  // 80% pool usage triggers warning
      criticalPoolUsage: 0.95, // 95% pool usage triggers critical
      maxWaitQueueSize: 100,
      maxConnectionErrors: 10
    };
  }

  /**
   * Initialize pool monitoring
   */
  initialize() {
    console.log('📊 Initializing MongoDB connection pool monitor...');

    // Monitor connection events
    mongoose.connection.on('connected', () => {
      this.poolStats.poolHealth = 'healthy';
      this.poolStats.totalConnections++;
      this._updateMetrics();
    });

    mongoose.connection.on('error', (err) => {
      this.poolStats.connectionErrors++;
      this._checkPoolHealth();
      this._updateMetrics();
      console.warn(`⚠️  Connection error (total: ${this.poolStats.connectionErrors}): ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      this.poolStats.poolHealth = 'disconnected';
      this._updateMetrics();
    });

    mongoose.connection.on('reconnected', () => {
      this.poolStats.poolHealth = 'healthy';
      this.poolStats.reconnects++;
      this._updateMetrics();
      console.log(`♻️  Reconnected (total: ${this.poolStats.reconnects})`);
    });

    // Periodic health check (every 30 seconds)
    this.healthCheckInterval = setInterval(() => {
      this._checkPoolHealth();
    }, 30000);

    console.log('✅ Connection pool monitor initialized');
  }

  /**
   * Get current pool statistics
   */
  getPoolStats() {
    try {
      const poolStats = mongoose.connection.getClient()?.topology?.s?.pool;
      
      if (poolStats) {
        this.poolStats.poolSize = poolStats.totalConnections || 0;
        this.poolStats.availableConnections = poolStats.availableConnections || 0;
        this.poolStats.waitQueueSize = poolStats.waitQueue?.length || 0;
      }

      this._checkPoolHealth();
      return {
        ...this.poolStats,
        timestamp: new Date(),
        connectionState: mongoose.connection.readyState,
        connectionURL: mongoose.connection.host ? `${mongoose.connection.host}:${mongoose.connection.port}` : 'unknown'
      };
    } catch (err) {
      console.error('❌ Failed to get pool stats:', err.message);
      return { ...this.poolStats, error: err.message };
    }
  }

  /**
   * Check and update pool health status
   */
  _checkPoolHealth() {
    const stats = this.poolStats;

    // Determine health based on thresholds
    if (stats.connectionErrors >= this.thresholds.maxConnectionErrors) {
      this.poolStats.poolHealth = 'critical';
    } else if (stats.waitQueueSize > this.thresholds.maxWaitQueueSize) {
      this.poolStats.poolHealth = 'warning';
    } else if (mongoose.connection.readyState === 0) {
      this.poolStats.poolHealth = 'disconnected';
    } else if (mongoose.connection.readyState === 1) {
      this.poolStats.poolHealth = 'healthy';
    }

    // Log warnings if needed
    if (this.poolStats.poolHealth === 'critical') {
      console.error('🔴 CRITICAL: Connection pool health is critical!');
      console.error(`   Errors: ${stats.connectionErrors}, Queue: ${stats.waitQueueSize}`);
    } else if (this.poolStats.poolHealth === 'warning') {
      console.warn('🟡 WARNING: Connection pool under stress!');
      console.warn(`   Queue size: ${stats.waitQueueSize}, Health: ${this.poolStats.poolHealth}`);
    }
  }

  /**
   * Update Prometheus metrics if collector available
   */
  _updateMetrics() {
    if (!this.metrics) return;

    try {
      const stats = this.getPoolStats();
      this.metrics.recordConnectionPoolMetrics({
        activeConnections: stats.poolSize - stats.availableConnections,
        availableConnections: stats.availableConnections,
        totalConnections: stats.poolSize,
        waitQueueSize: stats.waitQueueSize,
        health: stats.poolHealth === 'healthy' ? 1 : 0
      });
    } catch (err) {
      // Silently fail — metrics not critical
    }
  }

  /**
   * Get pool configuration
   */
  getConfiguration() {
    const connection = mongoose.connection;
    return {
      host: connection.host,
      port: connection.port,
      name: connection.name,
      readyState: connection.readyState,
      readyStateLabel: ['disconnected', 'connected', 'connecting', 'disconnecting'][connection.readyState],
      uri: connection.client?.s?.url || 'unknown'
    };
  }

  /**
   * Get detailed pool diagnostics
   */
  getDiagnostics() {
    const client = mongoose.connection.getClient();
    const topology = client?.topology;

    return {
      poolStats: this.getPoolStats(),
      config: this.getConfiguration(),
      topology: {
        type: topology?.description?.type || 'unknown',
        servers: topology?.description?.servers?.length || 0,
        sessionPool: topology?.sessionPool?.serverSessionPool?.length || 0
      },
      warnings: this._generateWarnings(),
      recommendations: this._generateRecommendations()
    };
  }

  /**
   * Generate warnings based on current state
   */
  _generateWarnings() {
    const warnings = [];
    const stats = this.poolStats;

    if (stats.connectionErrors > 0) {
      warnings.push(`⚠️  ${stats.connectionErrors} connection errors detected`);
    }
    if (stats.waitQueueSize > 50) {
      warnings.push(`⚠️  Large wait queue (${stats.waitQueueSize} connections waiting)`);
    }
    if (stats.poolHealth !== 'healthy') {
      warnings.push(`⚠️  Pool health status: ${stats.poolHealth}`);
    }
    if (mongoose.connection.readyState !== 1) {
      warnings.push('⚠️  Connection not in optimal state');
    }

    return warnings;
  }

  /**
   * Generate recommendations based on diagnostics
   */
  _generateRecommendations() {
    const recommendations = [];
    const stats = this.poolStats;

    if (stats.waitQueueSize > 50) {
      recommendations.push('📌 Increase maxPoolSize in connection options');
      recommendations.push('📌 Review query patterns for optimization opportunities');
      recommendations.push('📌 Consider database indexing improvements');
    }

    if (stats.connectionErrors > 5) {
      recommendations.push('📌 Check MongoDB server health and network connectivity');
      recommendations.push('📌 Review database logs for errors');
      recommendations.push('📌 Verify firewall and security group rules');
    }

    if (stats.poolHealth === 'warning' || stats.poolHealth === 'critical') {
      recommendations.push('📌 Consider horizontal scaling or read replicas');
      recommendations.push('📌 Implement connection pooling at application level');
      recommendations.push('📌 Review slow query logs');
    }

    return recommendations;
  }

  /**
   * Reset error counters
   */
  resetCounters() {
    this.poolStats.connectionErrors = 0;
    console.log('✅ Connection error counters reset');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      console.log('✅ Connection pool monitor stopped');
    }
  }
}

module.exports = ConnectionPoolMonitor;
