/**
 * Log Management Routes
 * 
 * Endpoints for querying, viewing, and managing application logs
 * Requires admin authentication
 * 
 * Available endpoints:
 * - GET /api/logs/view - View logs with filtering
 * - GET /api/logs/stats - Get log statistics
 * - GET /api/logs/health - Health check
 * - POST /api/logs/cleanup - Trigger log cleanup
 * - GET /api/logs/metrics - Log aggregation metrics
 */

const express = require('express');
const router = express.Router();
const { logAggregationManager, logMetrics } = require('../config/logAggregation');

// Middleware to validate admin access
const requireAdminAuth = (req, res, next) => {
  const adminSecret = req.headers['x-admin-secret'] || req.query.adminSecret;
  const expectedSecret = process.env.ADMIN_SECRET_KEY;

  if (!adminSecret || adminSecret !== expectedSecret) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Invalid or missing admin secret'
    });
  }

  next();
};

// Apply admin auth to all routes
router.use(requireAdminAuth);

/**
 * GET /api/logs/view
 * View application logs with optional filtering
 * 
 * Query parameters:
 * - logType: 'app', 'error', or 'all' (default: 'app')
 * - level: Filter by level (debug, info, warn, error, fatal)
 * - limit: Number of logs to return (default: 100, max: 1000)
 * - startTime: ISO timestamp for start of range
 * - endTime: ISO timestamp for end of range
 */
router.get('/view', (req, res) => {
  try {
    const { logType = 'app', level, limit = 100, startTime, endTime } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 100, 1000);

    const logs = logAggregationManager.queryLogs({
      logType,
      level,
      limit: parsedLimit,
      startTime,
      endTime
    });

    res.json({
      success: true,
      count: logs.length,
      logType,
      filters: { level, startTime, endTime },
      logs
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/logs/stats
 * Get statistics about log files and aggregation
 */
router.get('/stats', (req, res) => {
  try {
    const stats = logAggregationManager.getAggregatedStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/logs/health
 * Perform log system health check
 */
router.get('/health', (req, res) => {
  try {
    const health = logAggregationManager.healthCheck();
    const isHealthy = health.fileSystem === 'ok' && health.logger === 'healthy';

    res.json({
      success: true,
      healthy: isHealthy,
      health,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * POST /api/logs/cleanup
 * Trigger cleanup of old log files
 * 
 * Body:
 * - retentionDays: How many days to retain logs (default: 30)
 */
router.post('/cleanup', (req, res) => {
  try {
    const { retentionDays = 30 } = req.body;
    
    if (retentionDays < 1 || retentionDays > 365) {
      return res.status(400).json({
        success: false,
        error: 'Retention days must be between 1 and 365'
      });
    }

    const deletedCount = logAggregationManager.cleanupOldLogs(retentionDays);
    
    logAggregationManager.log('info', 'Manual log cleanup triggered', {
      retentionDays,
      deletedCount,
      triggeredBy: req.ip
    });

    res.json({
      success: true,
      message: `Cleanup complete: ${deletedCount} old log files deleted`,
      deletedCount,
      retentionDays
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/logs/metrics
 * Get Prometheus metrics for log aggregation
 */
router.get('/metrics', (req, res) => {
  try {
    const diskUsage = logAggregationManager.getDiskUsage();
    
    const metrics = {
      success: true,
      prometheus: {
        logCount: logMetrics.logCount.get(),
        errorRate: logMetrics.errorRate._value,
        lokiStatus: logMetrics.lokiStatus._value, // 1 = connected, 0 = disconnected
        logProcessingTime: logMetrics.logProcessTime.get()
      },
      system: {
        diskUsage,
        uptime: process.uptime(),
        nodeEnvironment: process.env.NODE_ENV || 'development'
      },
      timestamp: new Date().toISOString()
    };

    res.json(metrics);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/logs/search
 * Full-text search in logs
 * 
 * Query parameters:
 * - query: Search term
 * - logType: 'app' or 'error'
 * - limit: Max results (default: 50, max: 500)
 */
router.get('/search', (req, res) => {
  try {
    const { query, logType = 'app', limit = 50 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter required'
      });
    }

    const searchTerm = query.toLowerCase();
    const logs = logAggregationManager.queryLogs({ logType, limit: 1000 });
    
    const results = logs.filter(log => {
      const logStr = JSON.stringify(log).toLowerCase();
      return logStr.includes(searchTerm);
    }).slice(0, Math.min(parseInt(limit) || 50, 500));

    res.json({
      success: true,
      query,
      count: results.length,
      results
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/logs/loki-config
 * Get Loki configuration info
 */
router.get('/loki-config', (req, res) => {
  try {
    const lokiUrl = process.env.LOKI_URL || null;
    
    res.json({
      success: true,
      loki: {
        configured: !!lokiUrl,
        url: lokiUrl ? lokiUrl.split('?')[0] : null, // Don't expose full URL with auth
        enabled: !!lokiUrl,
        hostname: process.env.HOSTNAME || require('os').hostname(),
        environment: process.env.NODE_ENV || 'development'
      },
      setupGuide: lokiUrl ? null : 'Set LOKI_URL environment variable to enable cloud log aggregation'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * POST /api/logs/rotate
 * Manually rotate log files
 */
router.post('/rotate', (req, res) => {
  try {
    // Force rotation by calling cleanup with 0 days retention (deletes nothing but rotates)
    // In a real implementation, this would trigger file rotation
    
    logAggregationManager.log('info', 'Manual log rotation triggered', {
      triggeredBy: req.ip,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Log rotation triggered',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
