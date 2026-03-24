/**
 * Distributed Tracing Admin Routes
 * 
 * Endpoints for viewing and analyzing request traces
 */

const express = require('express');
const router = express.Router();
const { tracer } = require('../config/tracer');

// Admin auth middleware
const requireAdminAuth = (req, res, next) => {
  const adminSecret = req.headers['x-admin-secret'] || req.query.adminSecret;
  const expectedSecret = process.env.ADMIN_SECRET_KEY;

  if (!adminSecret || adminSecret !== expectedSecret) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized'
    });
  }
  next();
};

router.use(requireAdminAuth);

/**
 * GET /api/traces/stats
 * Get tracing statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = tracer.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/traces/recent
 * Get recent traces
 */
router.get('/recent', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const spans = tracer.getRecentSpans(limit);

    res.json({
      success: true,
      count: spans.length,
      spans
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/traces/:traceId
 * Get a specific trace
 */
router.get('/:traceId', (req, res) => {
  try {
    const spans = tracer.getSpansByTraceId(req.params.traceId);
    
    if (spans.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Trace not found'
      });
    }

    // Calculate trace duration
    const sortedByTime = spans.sort((a, b) => a.startTime - b.startTime);
    const traceDuration = sortedByTime.length > 0
      ? (sortedByTime[sortedByTime.length - 1].startTime + sortedByTime[sortedByTime.length - 1].duration) -
        sortedByTime[0].startTime
      : 0;

    res.json({
      success: true,
      traceId: req.params.traceId,
      spanCount: spans.length,
      traceDuration,
      spans
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/traces/operation/:operationName
 * Get spans by operation
 */
router.get('/operation/:operationName', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const spans = tracer.getSpansByOperation(req.params.operationName)
      .slice(-limit);

    res.json({
      success: true,
      operationName: req.params.operationName,
      count: spans.length,
      spans
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/traces/search
 * Search spans with filters
 */
router.post('/search', (req, res) => {
  try {
    const { operation, minDuration, maxDuration, hasError } = req.body;

    const spans = tracer.searchSpans({
      operation,
      minDuration: minDuration || 0,
      maxDuration: maxDuration || Infinity,
      hasError: hasError === true
    });

    res.json({
      success: true,
      count: spans.length,
      query: { operation, minDuration, maxDuration, hasError },
      spans: spans.slice(-100) // Return last 100
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/traces/slow
 * Get slowest operations (>1 second)
 */
router.get('/slow', (req, res) => {
  try {
    const stats = tracer.getStats();
    res.json({
      success: true,
      slowestOperations: stats.slowestSpans,
      threshold: '1000ms'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/traces/errors
 * Get recent errors
 */
router.get('/errors', (req, res) => {
  try {
    const stats = tracer.getStats();
    res.json({
      success: true,
      recentErrors: stats.recentErrors,
      errorCount: stats.recentErrors.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/traces/jaeger-config
 * Get Jaeger configuration
 */
router.get('/jaeger-config', (req, res) => {
  res.json({
    success: true,
    jaeger: {
      enabled: tracer.jaegerEnabled,
      endpoint: tracer.jaegerEndpoint || null,
      setupGuide: 'Set JAEGER_ENDPOINT environment variable to http://localhost:16686'
    },
    instructions: {
      docker: 'docker run -d -p 6831:6831/udp -p 16686:16686 jaegertracing/all-in-one',
      helm: 'helm install jaeger jaegertracing/jaeger',
      environment: {
        JAEGER_ENDPOINT: 'http://jaeger-collector:14268/api/traces'
      }
    }
  });
});

/**
 * GET /api/traces/health
 * Check tracing system health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    tracing: {
      enabled: true,
      active: tracer.spans.length > 0,
      bufferedSpans: tracer.spans.length,
      jaeger: tracer.jaegerEnabled ? 'connected' : 'disabled'
    }
  });
});

module.exports = router;
