/**
 * Log Aggregation System
 * 
 * Features:
 * - Winston logger with multiple transports (file, Loki, console)
 * - Centralized log control and querying
 * - Prometheus metrics for log volume and errors
 * - Structured JSON logging ready for ELK, Splunk, Datadog, etc.
 * - Log retention and cleanup policies
 * - Request correlation tracking
 * 
 * Configuration:
 * - LOKI_URL: For cloud log aggregation (optional)
 * - LOG_LEVEL: debug, info, warn, error, fatal
 * - LOG_RETENTION_DAYS: How long to keep log files
 */

const winston = require('winston');
const LokiTransport = require('winston-loki');
const path = require('path');
const fs = require('fs');
const os = require('os');
const promClient = require('prom-client');

// Create logs directory
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ============================================================================
// PROMETHEUS METRICS FOR LOG AGGREGATION
// ============================================================================
const logMetrics = {
  logCount: new promClient.Counter({
    name: 'logs_total',
    help: 'Total number of logs by level',
    labelNames: ['level', 'service']
  }),
  
  errorRate: new promClient.Gauge({
    name: 'log_error_rate',
    help: 'Current error log rate (errors per minute)'
  }),
  
  logProcessTime: new promClient.Histogram({
    name: 'log_processing_duration_ms',
    help: 'Time to process and aggregate logs',
    buckets: [10, 50, 100, 500, 1000]
  }),
  
  lokiStatus: new promClient.Gauge({
    name: 'loki_connection_status',
    help: '1 = connected, 0 = disconnected'
  })
};

// ============================================================================
// TRANSPORT CONFIGURATION
// ============================================================================

// File transport with rotation
const fileTransport = new winston.transports.File({
  filename: path.join(logsDir, 'app.log'),
  maxsize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10, // Keep 10 files
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  )
});

const errorTransport = new winston.transports.File({
  filename: path.join(logsDir, 'error.log'),
  level: 'error',
  maxsize: 10 * 1024 * 1024,
  maxFiles: 10,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  )
});

// Loki transport for cloud aggregation (optional)
let lokiTransport = null;
const initLokiTransport = () => {
  const lokiUrl = process.env.LOKI_URL;
  
  if (!lokiUrl) {
    console.log('[LogAggregation] Loki not configured (no LOKI_URL env var)');
    logMetrics.lokiStatus.set(0);
    return;
  }

  try {
    lokiTransport = new LokiTransport({
      host: lokiUrl,
      labels: {
        app: 'chuka-cribs',
        environment: process.env.NODE_ENV || 'development',
        hostname: os.hostname(),
        version: process.env.APP_VERSION || '1.0.0'
      },
      json: true,
      format: winston.format.json(),
      onConnectionError: (err) => {
        console.error('[LogAggregation] Loki connection error:', err.message);
        logMetrics.lokiStatus.set(0);
      }
    });

    lokiTransport.on('connect', () => {
      console.log('[LogAggregation] Connected to Loki:', lokiUrl);
      logMetrics.lokiStatus.set(1);
    });

    console.log('[LogAggregation] Loki transport initialized');
    logMetrics.lokiStatus.set(1);
    return lokiTransport;
  } catch (err) {
    console.error('[LogAggregation] Failed to initialize Loki:', err.message);
    logMetrics.lokiStatus.set(0);
    return null;
  }
};

// ============================================================================
// WINSTON LOGGER FACTORY
// ============================================================================

class LogAggregationManager {
  constructor() {
    this.loggers = new Map();
    this.sharedLogger = null;
    this.errorCount = 0;
    this.lastErrorReset = Date.now();
  }

  /**
   * Initialize the shared logger
   */
  initializeLogger() {
    const transports = [
      fileTransport,
      errorTransport,
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf(({ level, message, timestamp, requestId, ...meta }) => {
            const reqId = requestId ? ` [${requestId}]` : '';
            return `${timestamp}${reqId} [${level}] ${message} ${JSON.stringify(meta)}`;
          })
        )
      })
    ];

    // Add Loki if available
    lokiTransport = initLokiTransport();
    if (lokiTransport) {
      transports.push(lokiTransport);
    }

    this.sharedLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'chuka-cribs',
        environment: process.env.NODE_ENV || 'development'
      },
      transports
    });

    // Handle transport errors
    this.sharedLogger.on('error', (err) => {
      console.error('[LogAggregation] Logger error:', err.message);
    });

    return this.sharedLogger;
  }

  /**
   * Get or create context-specific logger
   */
  getLogger(context = 'app', requestId = null) {
    const key = `${context}-${requestId || 'shared'}`;
    
    if (!this.loggers.has(key)) {
      // Return shared logger with context metadata
      const childLogger = this.sharedLogger.child({
        context,
        requestId: requestId || this.generateRequestId()
      });
      this.loggers.set(key, childLogger);
    }

    return this.loggers.get(key);
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log with automatic metrics
   */
  log(level, message, data = {}) {
    const startTime = Date.now();
    
    this.sharedLogger.log(level, message, data);
    
    // Update metrics
    logMetrics.logCount.inc({ level, service: 'chuka-cribs' });
    logMetrics.logProcessTime.observe(Date.now() - startTime);

    // Track error rate
    if (level === 'error' || level === 'fatal') {
      this.errorCount++;
      this.updateErrorRate();
    }
  }

  /**
   * Update error rate gauge
   */
  updateErrorRate() {
    // Reset counter every minute
    const now = Date.now();
    if (now - this.lastErrorReset > 60000) {
      logMetrics.errorRate.set(this.errorCount / (now - this.lastErrorReset) * 60000);
      this.errorCount = 0;
      this.lastErrorReset = now;
    }
  }

  /**
   * Query logs from file system
   */
  queryLogs(options = {}) {
    const {
      logType = 'app', // 'app', 'error', 'all'
      limit = 100,
      level = null,
      startTime = null,
      endTime = null
    } = options;

    const logFile = logType === 'error' 
      ? path.join(logsDir, 'error.log')
      : path.join(logsDir, 'app.log');

    try {
      if (!fs.existsSync(logFile)) {
        return [];
      }

      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Parse JSON logs and filter
      const logs = lines
        .map((line, idx) => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return { raw: line, idx };
          }
        })
        .filter(log => {
          if (!log) return false;
          if (level && log.level !== level) return false;
          if (startTime && new Date(log.timestamp) < new Date(startTime)) return false;
          if (endTime && new Date(log.timestamp) > new Date(endTime)) return false;
          return true;
        })
        .reverse() // Most recent first
        .slice(0, limit);

      return logs;
    } catch (err) {
      console.error(`[LogAggregation] Error querying logs:`, err.message);
      return [];
    }
  }

  /**
   * Get log file statistics
   */
  getLogStats() {
    try {
      const stats = {};
      const files = ['app.log', 'error.log'];

      files.forEach(filename => {
        const filepath = path.join(logsDir, filename);
        if (fs.existsSync(filepath)) {
          const fileStats = fs.statSync(filepath);
          const lineCount = fs.readFileSync(filepath, 'utf-8').split('\n').length;
          
          stats[filename] = {
            size: `${(fileStats.size / 1024 / 1024).toFixed(2)} MB`,
            lines: lineCount,
            created: fileStats.birthtime,
            modified: fileStats.mtime
          };
        }
      });

      return stats;
    } catch (err) {
      console.error('[LogAggregation] Error getting stats:', err.message);
      return {};
    }
  }

  /**
   * Clear old log files based on retention policy
   */
  cleanupOldLogs(retentionDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const files = fs.readdirSync(logsDir);
      let deletedCount = 0;

      files.forEach(filename => {
        const filepath = path.join(logsDir, filename);
        const stats = fs.statSync(filepath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        this.log('info', `Log cleanup: deleted ${deletedCount} old log files`, {
          retentionDays,
          deletedCount
        });
      }

      return deletedCount;
    } catch (err) {
      console.error('[LogAggregation] Error cleaning up logs:', err.message);
      return 0;
    }
  }

  /**
   * Get aggregated log statistics
   */
  getAggregatedStats() {
    const stats = this.getLogStats();
    const errorLogs = this.queryLogs({ logType: 'error', limit: 1000 });
    const allLogs = this.queryLogs({ limit: 1000 });

    const errorsByLevel = {};
    errorLogs.forEach(log => {
      errorsByLevel[log.level] = (errorsByLevel[log.level] || 0) + 1;
    });

    return {
      files: stats,
      totalLogs: allLogs.length,
      errorLogsCount: errorLogs.length,
      errorsByLevel,
      lokiConnected: logMetrics.lokiStatus._value === 1,
      retention: { days: 30 }
    };
  }

  /**
   * Perform health check
   */
  healthCheck() {
    return {
      logger: 'healthy',
      fileSystem: fs.existsSync(logsDir) ? 'ok' : 'fail',
      loki: logMetrics.lokiStatus._value === 1 ? 'connected' : 'disconnected',
      diskUsage: this.getDiskUsage()
    };
  }

  /**
   * Get disk usage for logs directory
   */
  getDiskUsage() {
    try {
      let totalSize = 0;
      const files = fs.readdirSync(logsDir);
      
      files.forEach(filename => {
        const filepath = path.join(logsDir, filename);
        const stats = fs.statSync(filepath);
        totalSize += stats.size;
      });

      return {
        totalBytes: totalSize,
        totalMB: (totalSize / 1024 / 1024).toFixed(2),
        files: files.length
      };
    } catch (err) {
      return { error: err.message };
    }
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

const logAggregationManager = new LogAggregationManager();
logAggregationManager.initializeLogger();

module.exports = {
  logAggregationManager,
  logMetrics,
  LogAggregationManager
};
