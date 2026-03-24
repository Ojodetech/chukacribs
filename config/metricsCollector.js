/**
 * Prometheus Metrics Integration
 * 
 * Collects application metrics for monitoring and alerting
 * Features:
 * - HTTP request metrics (latency, status codes, throughput)
 * - Business metrics (bookings, payments, users)
 * - System metrics (memory, CPU, database connections)
 * - Custom alerts and dashboards
 */

const prometheus = require('prom-client');
const logger = require('./logger');

// Create custom metrics registry
const register = new prometheus.Registry();

// Default metrics (memory, CPU, etc.)
prometheus.collectDefaultMetrics({ register });

/**
 * HTTP Request Metrics
 */
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestSize = new prometheus.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register]
});

const httpResponseSize = new prometheus.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register]
});

/**
 * Database Metrics
 */
const dbQueryDuration = new prometheus.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['collection', 'operation'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register]
});

const dbConnectionsActive = new prometheus.Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [register]
});

const dbConnectionsTotal = new prometheus.Counter({
  name: 'db_connections_total',
  help: 'Total number of database connections',
  registers: [register]
});

const dbErrors = new prometheus.Counter({
  name: 'db_errors_total',
  help: 'Total number of database errors',
  labelNames: ['operation', 'error_type'],
  registers: [register]
});

/**
 * Business Metrics
 */
const bookingsCreated = new prometheus.Counter({
  name: 'bookings_created_total',
  help: 'Total number of bookings created',
  registers: [register]
});

const bookingsCompleted = new prometheus.Counter({
  name: 'bookings_completed_total',
  help: 'Total number of bookings completed',
  registers: [register]
});

const bookingsCancelled = new prometheus.Counter({
  name: 'bookings_cancelled_total',
  help: 'Total number of bookings cancelled',
  registers: [register]
});

const bookingsDuration = new prometheus.Histogram({
  name: 'bookings_duration_days',
  help: 'Duration of bookings in days',
  buckets: [1, 7, 30, 90, 180, 365],
  registers: [register]
});

const paymentsTotal = new prometheus.Counter({
  name: 'payments_total',
  help: 'Total amount of payments processed',
  labelNames: ['status', 'method'],
  registers: [register]
});

const paymentsSuccess = new prometheus.Counter({
  name: 'payments_successful_total',
  help: 'Total number of successful payments',
  registers: [register]
});

const paymentsFailed = new prometheus.Counter({
  name: 'payments_failed_total',
  help: 'Total number of failed payments',
  labelNames: ['reason'],
  registers: [register]
});

const paymentsDuration = new prometheus.Histogram({
  name: 'payment_processing_duration_seconds',
  help: 'Payment processing time in seconds',
  buckets: [0.1, 0.5, 1, 5, 10],
  registers: [register]
});

const housesListed = new prometheus.Gauge({
  name: 'houses_listed_total',
  help: 'Total number of houses listed',
  registers: [register]
});

const housesActive = new prometheus.Gauge({
  name: 'houses_active_total',
  help: 'Total number of active house listings',
  registers: [register]
});

const usersRegistered = new prometheus.Counter({
  name: 'users_registered_total',
  help: 'Total number of users registered',
  registers: [register]
});

const usersActive = new prometheus.Gauge({
  name: 'users_active_total',
  help: 'Total number of active users',
  registers: [register]
});

/**
 * Cache Metrics
 */
const cacheHits = new prometheus.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_type'],
  registers: [register]
});

const cacheMisses = new prometheus.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache_type'],
  registers: [register]
});

const cacheSize = new prometheus.Gauge({
  name: 'cache_size_bytes',
  help: 'Cache size in bytes',
  labelNames: ['cache_type'],
  registers: [register]
});

/**
 * Authentication Metrics
 */
const authAttempts = new prometheus.Counter({
  name: 'auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['success'],
  registers: [register]
});

const authFailures = new prometheus.Counter({
  name: 'auth_failures_total',
  help: 'Total authentication failures',
  labelNames: ['reason'],
  registers: [register]
});

const sessionsActive = new prometheus.Gauge({
  name: 'sessions_active_total',
  help: 'Total active user sessions',
  registers: [register]
});

/**
 * Security Metrics
 */
const securityEvents = new prometheus.Counter({
  name: 'security_events_total',
  help: 'Total security events',
  labelNames: ['event_type', 'severity'],
  registers: [register]
});

const rateLimitExceeded = new prometheus.Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total rate limit violations',
  labelNames: ['endpoint'],
  registers: [register]
});

/**
 * Error Metrics
 */
const errors = new prometheus.Counter({
  name: 'errors_total',
  help: 'Total errors',
  labelNames: ['error_type', 'severity'],
  registers: [register]
});

/**
 * MetricsCollector - Unified metrics interface
 */
class MetricsCollector {
  constructor() {
    this.register = register;
  }
  
  /**
   * Record HTTP request
   */
  recordHttpRequest(method, route, statusCode, duration, requestSize, responseSize) {
    httpRequestDuration.labels(method, route, statusCode).observe(duration);
    httpRequestsTotal.labels(method, route, statusCode).inc();
    
    if (requestSize) {
      httpRequestSize.labels(method, route).observe(requestSize);
    }
    if (responseSize) {
      httpResponseSize.labels(method, route, statusCode).observe(responseSize);
    }
  }
  
  /**
   * Record database query
   */
  recordDbQuery(collection, operation, duration) {
    dbQueryDuration.labels(collection, operation).observe(duration);
  }
  
  /**
   * Record database error
   */
  recordDbError(operation, errorType) {
    dbErrors.labels(operation, errorType).inc();
  }
  
  /**
   * Update active database connections
   */
  setDbConnections(count) {
    dbConnectionsActive.set(count);
  }
  
  /**
   * Record booking created
   */
  recordBookingCreated() {
    bookingsCreated.inc();
  }
  
  /**
   * Record booking completed
   */
  recordBookingCompleted(durationDays) {
    bookingsCompleted.inc();
    bookingsDuration.observe(durationDays);
  }
  
  /**
   * Record booking cancelled
   */
  recordBookingCancelled() {
    bookingsCancelled.inc();
  }
  
  /**
   * Record payment processed
   */
  recordPayment(amount, status, method) {
    if (status === 'success') {
      paymentsSuccess.inc();
    } else if (status === 'failed') {
      paymentsFailed.labels(method).inc();
    }
    paymentsTotal.labels(status, method).inc((amount || 0) / 100);
  }
  
  /**
   * Record payment processing duration
   */
  recordPaymentDuration(duration) {
    paymentsDuration.observe(duration);
  }
  
  /**
   * Update house metrics
   */
  setHousesListed(count) {
    housesListed.set(count);
  }
  
  setHousesActive(count) {
    housesActive.set(count);
  }
  
  /**
   * Record user registration
   */
  recordUserRegistered() {
    usersRegistered.inc();
  }
  
  /**
   * Update active users
   */
  setActiveUsers(count) {
    usersActive.set(count);
  }
  
  /**
   * Record cache hit/miss
   */
  recordCacheHit(cacheType) {
    cacheHits.labels(cacheType).inc();
  }
  
  recordCacheMiss(cacheType) {
    cacheMisses.labels(cacheType).inc();
  }
  
  /**
   * Update cache size
   */
  setCacheSize(cacheType, size) {
    cacheSize.labels(cacheType).set(size);
  }
  
  /**
   * Record authentication attempt
   */
  recordAuthAttempt(success) {
    authAttempts.labels(success ? 'success' : 'failure').inc();
  }
  
  /**
   * Record authentication failure
   */
  recordAuthFailure(reason) {
    authFailures.labels(reason).inc();
  }
  
  /**
   * Update active sessions
   */
  setActiveSessions(count) {
    sessionsActive.set(count);
  }
  
  /**
   * Record security event
   */
  recordSecurityEvent(eventType, severity) {
    securityEvents.labels(eventType, severity).inc();
  }
  
  /**
   * Record rate limit exceeded
   */
  recordRateLimitExceeded(endpoint) {
    rateLimitExceeded.labels(endpoint).inc();
  }
  
  /**
   * Record error
   */
  recordError(errorType, severity = 'medium') {
    errors.labels(errorType, severity).inc();
  }
  
  /**
   * Get all metrics for Prometheus scraping
   */
  async getMetrics() {
    return register.metrics();
  }
  
  /**
   * Get metrics in JSON format (for dashboards)
   */
  async getMetricsJson() {
    const metrics = await register.getMetricsAsJSON();
    return metrics;
  }
}

module.exports = new MetricsCollector();
