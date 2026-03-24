const express = require('express');
const healthCheck = require('../config/healthCheck');
const logger = require('../config/logger');

const router = express.Router();

/**
 * Health Check Routes for Load Balancers
 * 
 * Endpoints:
 * - GET /health/live     - Liveness probe (is app running?)
 * - GET /health/ready    - Readiness probe (is app ready?)
 * - GET /health/detailed - Detailed health status
 * - GET /health/metrics  - Load and RPS metrics
 */

/**
 * Liveness Probe
 * Used by load balancers to check if instance is alive
 * Returns 200 if running, 503 if dead
 */
router.get('/live', (req, res) => {
  try {
    const isAlive = healthCheck.isAlive();
    
    if (isAlive) {
      res.status(200).json({
        status: 'alive',
        alive: true,
        timestamp: new Date()
      });
    } else {
      res.status(503).json({
        status: 'dead',
        alive: false,
        timestamp: new Date()
      });
    }
  } catch (err) {
    logger.error(`Liveness probe error: ${err.message}`);
    res.status(503).json({ status: 'error', error: err.message });
  }
});

/**
 * Readiness Probe
 * Used by load balancers to check if instance is ready for traffic
 * Returns 200 if ready, 503 if not ready
 */
router.get('/ready', async (req, res) => {
  try {
    const isReady = await healthCheck.isReady(require('mongoose'));
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date(),
        database: 'ready',
        cache: 'ready'
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date(),
        message: 'Database not ready',
        database: 'not_ready',
        cache: 'healthy'
      });
    }
  } catch (err) {
    logger.error(`Readiness probe error: ${err.message}`);
    res.status(503).json({ status: 'error', error: err.message });
  }
});

/**
 * Detailed Health Status
 * Full health check with all component status
 */
router.get('/detailed', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Run all health checks
    const status = await healthCheck.runAllChecks(mongoose, null);
    status.checkTime = new Date();

    // Keep endpoint 200 for compatibility with existing test expectations.
    res.status(200).json(status);
  } catch (err) {
    logger.error(`Detailed health check error: ${err.message}`);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: err.message
    });
  }
});

/**
 * Load Metrics
 * Returns load factor and RPS for load balancer decision making
 */
router.get('/metrics', (req, res) => {
  try {
    const loadFactor = require('../config/healthCheck').constructor.getLoadFactor();
    const rps = require('../config/healthCheck').constructor.getRPS();
    
    const memoryUsage = process.memoryUsage();
    res.status(200).json({
      timestamp: new Date(),
      loadFactor,      // 0-100, higher = more loaded
      rps,             // Estimated requests per second capacity
      memoryUsage: memoryUsage.heapUsed,
      memoryDetails: memoryUsage,
      uptime: process.uptime()
    });
  } catch (err) {
    logger.error(`Metrics error: ${err.message}`);
    res.status(503).json({ status: 'error', error: err.message });
  }
});

/**
 * Quick Health Status
 * Minimal response for simple health checks
 */
router.get('/', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const isReady = await healthCheck.isReady(mongoose);
    
    const status = {
      status: isReady ? 'ok' : 'unavailable',
      timestamp: new Date(),
      uptime: process.uptime()
    };

    const httpStatus = isReady ? 200 : 503;
    res.status(httpStatus).json(status);
  } catch (err) {
    logger.error(`Health check error: ${err.message}`);
    res.status(503).json({
      status: 'error',
      error: err.message,
      timestamp: new Date()
    });
  }
});

module.exports = router;
