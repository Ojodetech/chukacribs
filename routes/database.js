/**
 * Database Connection Pool Monitoring Routes
 * Provides admin endpoints for viewing and managing connection pool health
 */

const express = require('express');
const router = express.Router();
const { verifyToken, adminOnly } = require('../middleware/auth');

let poolMonitor = null;

/**
 * Initialize pool monitor (call from index.js)
 */
function initializePoolMonitor(monitor) {
  poolMonitor = monitor;
}

/**
 * GET /api/database/pool/stats
 * Get current connection pool statistics
 */
router.get('/pool/stats', verifyToken, adminOnly, (req, res) => {
  try {
    if (!poolMonitor) {
      return res.status(503).json({
        success: false,
        message: 'Pool monitor not initialized'
      });
    }

    const stats = poolMonitor.getPoolStats();

    res.json({
      success: true,
      timestamp: new Date(),
      poolStats: {
        totalConnections: stats.poolSize,
        activeConnections: stats.poolSize - stats.availableConnections,
        availableConnections: stats.availableConnections,
        waitQueueSize: stats.waitQueueSize,
        health: stats.poolHealth,
        totalConnectionErrors: stats.connectionErrors,
        totalReconnects: stats.reconnects,
        connectionUrl: stats.connectionURL
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pool stats',
      error: err.message
    });
  }
});

/**
 * GET /api/database/pool/diagnostics
 * Get detailed pool diagnostics and recommendations
 */
router.get('/pool/diagnostics', verifyToken, adminOnly, (req, res) => {
  try {
    if (!poolMonitor) {
      return res.status(503).json({
        success: false,
        message: 'Pool monitor not initialized'
      });
    }

    const diagnostics = poolMonitor.getDiagnostics();

    res.json({
      success: true,
      diagnostics: {
        poolStats: {
          totalConnections: diagnostics.poolStats.poolSize,
          activeConnections: diagnostics.poolStats.poolSize - diagnostics.poolStats.availableConnections,
          availableConnections: diagnostics.poolStats.availableConnections,
          waitQueueSize: diagnostics.poolStats.waitQueueSize,
          health: diagnostics.poolStats.poolHealth,
          errors: diagnostics.poolStats.connectionErrors,
          reconnects: diagnostics.poolStats.reconnects
        },
        configuration: diagnostics.config,
        topology: diagnostics.topology,
        warnings: diagnostics.warnings,
        recommendations: diagnostics.recommendations
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve diagnostics',
      error: err.message
    });
  }
});

/**
 * GET /api/database/pool/config
 * Get connection pool configuration
 */
router.get('/pool/config', verifyToken, adminOnly, (req, res) => {
  try {
    if (!poolMonitor) {
      return res.status(503).json({
        success: false,
        message: 'Pool monitor not initialized'
      });
    }

    const config = poolMonitor.getConfiguration();

    res.json({
      success: true,
      configuration: {
        ...config,
        minPoolSize: process.env.NODE_ENV === 'production' ? 10 : 5,
        maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10,
        maxIdleTimeMS: 120000,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 60000,
        connectTimeoutMS: 30000,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve configuration',
      error: err.message
    });
  }
});

/**
 * POST /api/database/pool/reset-counters
 * Reset connection error counters
 */
router.post('/pool/reset-counters', verifyToken, adminOnly, (req, res) => {
  try {
    if (!poolMonitor) {
      return res.status(503).json({
        success: false,
        message: 'Pool monitor not initialized'
      });
    }

    poolMonitor.resetCounters();

    res.json({
      success: true,
      message: 'Connection counters reset successfully',
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to reset counters',
      error: err.message
    });
  }
});

/**
 * GET /api/database/health
 * Quick health check endpoint (can be public or protected)
 */
router.get('/health', (req, res) => {
  try {
    if (!poolMonitor) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'Database monitor not initialized'
      });
    }

    const stats = poolMonitor.getPoolStats();
    const isHealthy = stats.poolHealth === 'healthy' && stats.connectionErrors === 0;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      poolHealth: stats.poolHealth,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

module.exports = { router, initializePoolMonitor };
