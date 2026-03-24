/**
 * Structured Logging System - Production Grade
 * Features:
 * - JSON structured logging
 * - Automatic log rotation (daily, size-based)
 * - Request correlation IDs for tracing
 * - Log aggregation ready (ELK, LogRocket, Datadog)
 * - Performance metrics logging
 * - Error stack trace preservation
 */

const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const os = require('os');

// Configuration
const LOG_DIR = path.join(__dirname, '../logs');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10; // Keep 10 rotated log files
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log levels with numeric values for filtering
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

const LEVEL_RANK = LOG_LEVELS[LOG_LEVEL] || 1;

/**
 * Main Logger Class
 */
class StructuredLogger {
  constructor(options = {}) {
    this.context = options.context || 'app';
    this.requestId = options.requestId || this.generateRequestId();
    this.streams = {
      all: this.createRotatingStream('all'),
      error: this.createRotatingStream('error'),
      access: this.createRotatingStream('access')
    };
    this.startTime = Date.now();
  }

  /**
   * Generate unique request ID for tracing
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a rotating file stream
   */
  createRotatingStream(filename) {
    const filePath = path.join(LOG_DIR, `${filename}.log`);
    
    const stream = createWriteStream(filePath, { flags: 'a' });
    let fileSize = 0;

    // Get current file size
    try {
      const stats = fs.statSync(filePath);
      fileSize = stats.size;
    } catch (err) {
      fileSize = 0;
    }

    // Monitor file size and rotate if needed
    const checkRotation = (data) => {
      fileSize += data.length;
      if (fileSize > MAX_FILE_SIZE) {
        this.rotateLogFile(filename);
        fileSize = 0;
      }
    };

    stream.on('write', checkRotation);

    return stream;
  }

  /**
   * Rotate log files (keep MAX_FILES versions)
   */
  rotateLogFile(filename) {
    const basePath = path.join(LOG_DIR, filename);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = path.join(LOG_DIR, `${filename}-${timestamp}.log`);

    try {
      if (fs.existsSync(`${basePath}.log`)) {
        fs.renameSync(`${basePath}.log`, rotatedPath);
      }

      // Delete old files beyond retention
      const files = fs.readdirSync(LOG_DIR)
        .filter(f => f.startsWith(filename))
        .sort()
        .reverse();

      if (files.length > MAX_FILES) {
        files.slice(MAX_FILES).forEach(f => {
          try {
            fs.unlinkSync(path.join(LOG_DIR, f));
          } catch (err) {
            // Ignore deletion errors
          }
        });
      }

      // Recreate stream
      this.streams[filename] = this.createRotatingStream(filename);
    } catch (err) {
      console.error(`Failed to rotate log file ${filename}:`, err.message);
    }
  }

  /**
   * Format structured log entry (JSON)
   */
  formatLog(level, message, data = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      requestId: this.requestId,
      context: this.context,
      message,
      hostname: os.hostname(),
      pid: process.pid,
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      ...data
    });
  }

  /**
   * Write to appropriate stream
   */
  writeLog(level, message, data = {}) {
    const formatted = this.formatLog(level, message, data);
    const levelRank = LOG_LEVELS[level] || 1;

    // Write to all logs
    this.streams.all.write(`${formatted  }\n`);

    // Write errors to error log
    if (level === 'error' || level === 'fatal') {
      this.streams.error.write(`${formatted  }\n`);
    }

    // Only console.log in development
    if (process.env.NODE_ENV !== 'production') {
      const color = {
        debug: '\x1b[36m',    // Cyan
        info: '\x1b[32m',     // Green
        warn: '\x1b[33m',     // Yellow
        error: '\x1b[31m',    // Red
        fatal: '\x1b[35m'     // Magenta
      }[level] || '\x1b[0m';

      const reset = '\x1b[0m';
      console.log(`${color}[${level.toUpperCase()}]${reset} ${message}`, data);
    }
  }

  /**
   * Log levels
   */
  debug(message, data = {}) {
    if (LEVEL_RANK <= LOG_LEVELS.debug) {
      this.writeLog('debug', message, data);
    }
  }

  info(message, data = {}) {
    if (LEVEL_RANK <= LOG_LEVELS.info) {
      this.writeLog('info', message, data);
    }
  }

  warn(message, data = {}) {
    if (LEVEL_RANK <= LOG_LEVELS.warn) {
      this.writeLog('warn', message, data);
    }
  }

  error(message, data = {}) {
    if (LEVEL_RANK <= LOG_LEVELS.error) {
      this.writeLog('error', message, {
        ...data,
        stack: data.stack || (new Error().stack).split('\n').slice(1, 5).join('\n')
      });
    }
  }

  fatal(message, data = {}) {
    this.writeLog('fatal', message, {
      ...data,
      stack: data.stack || (new Error().stack).split('\n').slice(1, 5).join('\n')
    });
  }

  /**
   * Log HTTP request/response
   */
  logHttpRequest(req, res, duration, statusCode) {
    this.streams.access.write(`${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'access',
      requestId: this.requestId,
      method: req.method,
      path: req.path,
      statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      userId: req.landlordId || req.userId || 'anonymous'
    })  }\n`);
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation, duration, metadata = {}) {
    this.info(`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      slow: duration > 1000,
      ...metadata
    });
  }

  /**
   * Close all streams
   */
  close() {
    Object.values(this.streams).forEach(stream => {
      try {
        stream.end();
      } catch (err) {
        // Ignore
      }
    });
  }
}

/**
 * Middleware for request logging with correlation ID
 */
const requestLoggingMiddleware = (req, res, next) => {
  // Create logger instance per request
  const requestId = req.get('x-request-id') || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.logger = new StructuredLogger({ requestId, context: req.path });
  res.setHeader('x-request-id', requestId);

  // Track response time
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log HTTP request
    req.logger.logHttpRequest(req, res, duration, statusCode);

    // Log slow requests
    if (duration > 1000) {
      req.logger.warn(`Slow request: ${req.method} ${req.path}`, {
        duration: `${duration}ms`,
        statusCode
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Global logger instance
 */
const globalLogger = new StructuredLogger({ context: 'global' });

module.exports = {
  StructuredLogger,
  requestLoggingMiddleware,
  globalLogger,
  LOG_LEVELS,
  LOG_DIR
};
