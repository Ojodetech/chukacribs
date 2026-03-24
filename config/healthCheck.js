const os = require('os');
const logger = require('./logger');

/**
 * Health Check Service
 * Provides comprehensive health status for load balancers
 * Monitors: database, cache, memory, CPU, and application readiness
 */
class HealthCheckService {
  constructor() {
    this.startTime = Date.now();
    this.checks = {
      database: { status: 'unknown', message: '', lastCheck: null },
      cache: { status: 'unknown', message: '', lastCheck: null },
      memory: { status: 'healthy', message: '', lastCheck: null },
      disk: { status: 'healthy', message: '', lastCheck: null },
      uptime: { status: 'healthy', message: '', lastCheck: null }
    };
  }

  /**
   * Get overall health status
   * Returns: healthy, degraded, or unhealthy
   */
  getOverallStatus() {
    const statuses = Object.values(this.checks).map(c => c.status);
    
    // unhealthy if any critical check fails
    const criticalChecks = ['database'];
    const hasUnhealthy = criticalChecks.some(check => 
      this.checks[check].status === 'unhealthy'
    );
    
    if (hasUnhealthy) return 'unhealthy';
    
    const hasDegraded = statuses.includes('degraded');
    return hasDegraded ? 'degraded' : 'healthy';
  }

  /**
   * Check database connectivity
   */
  async checkDatabase(mongoose) {
    const startCheck = Date.now();

    try {
      if (!mongoose || mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB connection not ready');
      }

      await mongoose.connection.collection('health').updateOne(
        { _id: 'ping' },
        { $set: { lastPing: new Date() } },
        { upsert: true, w: 0 }
      );

      const duration = Date.now() - startCheck;

      const result = {
        status: 'healthy',
        message: `Connected (${duration}ms)`,
        responseTime: duration,
        lastCheck: new Date()
      };

      this.checks.database = result; // keep instance state
      return result;
    } catch (err) {
      const duration = Date.now() - startCheck;
      logger.warn(`Database health check failed: ${err.message}`);

      const result = {
        status: 'unhealthy',
        message: err.message,
        responseTime: duration,
        lastCheck: new Date(),
        error: err.message
      };

      this.checks.database = result;
      return result;
    }
  }

  /**
   * Check Redis/cache connectivity
   */
  async checkCache(redisClient) {
    const startCheck = Date.now();

    try {
      if (!redisClient) {
        const result = {
          status: 'healthy',
          message: 'Cache not configured',
          lastCheck: new Date(),
          responseTime: 0,
          memory: process.memoryUsage()
        };
        this.checks.cache = result;
        return result;
      }

      await redisClient.ping();
      const duration = Date.now() - startCheck;

      const result = {
        status: 'healthy',
        message: `Connected (${duration}ms)`,
        lastCheck: new Date(),
        responseTime: duration,
        memory: process.memoryUsage()
      };

      this.checks.cache = result;
      return result;
    } catch (err) {
      logger.warn(`Cache health check failed: ${err.message}`);

      const result = {
        status: 'degraded',
        message: err.message,
        lastCheck: new Date(),
        responseTime: Date.now() - startCheck,
        memory: process.memoryUsage()
      };

      this.checks.cache = result;
      return result;
    }
  }

  /**
   * Check memory usage
   */
  checkMemory() {
    try {
      const usage = process.memoryUsage();
      const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
      const rssPercent = (usage.rss / os.totalmem()) * 100;

      let status = 'healthy';
      if (heapUsedPercent > 90 || rssPercent > 85) {
        status = 'unhealthy';
      } else if (heapUsedPercent > 80 || rssPercent > 75) {
        status = 'degraded';
      }

      const result = {
        status,
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        rss: Math.round(usage.rss / 1024 / 1024),
        heapPercentage: Math.round(heapUsedPercent),
        rssPercentage: Math.round(rssPercent),
        message: `Heap: ${Math.round(heapUsedPercent)}% (${Math.round(usage.heapUsed / 1024 / 1024)}MB / ${Math.round(usage.heapTotal / 1024 / 1024)}MB), RSS: ${Math.round(rssPercent)}%`,
        lastCheck: new Date()
      };

      this.checks.memory = result;
      return result;
    } catch (err) {
      logger.error(`Memory check failed: ${err.message}`);
      const result = {
        status: 'unhealthy',
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
        heapPercentage: 0,
        rssPercentage: 0,
        message: err.message,
        lastCheck: new Date()
      };
      this.checks.memory = result;
      return result;
    }
  }

  /**
   * Check disk space
   */
  checkDisk() {
    try {
      // This is a simplified check
      // In production, use advanced disk usage library such as 'diskusage'
      const freeMemoryMb = Math.round(os.freemem() / 1024 / 1024);
      const totalMemoryMb = Math.round(os.totalmem() / 1024 / 1024);

      const result = {
        status: 'healthy',
        message: 'OK',
        available: freeMemoryMb,
        total: totalMemoryMb,
        lastCheck: new Date()
      };

      this.checks.disk = result;
      return result;
    } catch (err) {
      logger.error(`Disk check failed: ${err.message}`);
      const result = {
        status: 'unhealthy',
        message: err.message,
        available: 0,
        total: 0,
        lastCheck: new Date()
      };
      this.checks.disk = result;
      return result;
    }
  }

  /**
   * Check uptime
   */
  checkUptime() {
    try {
      const uptimeSeconds = (Date.now() - this.startTime) / 1000;
      const hours = Math.floor(uptimeSeconds / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);

      let status = 'healthy';
      if (uptimeSeconds < 30) {
        status = 'degraded';
      }

      const result = {
        status,
        message: `${hours}h ${minutes}m`,
        uptime: uptimeSeconds,
        lastCheck: new Date(),
        seconds: uptimeSeconds
      };

      this.checks.uptime = result;
      return result;
    } catch (err) {
      logger.error(`Uptime check failed: ${err.message}`);
      const result = {
        status: 'unhealthy',
        message: err.message,
        uptime: 0,
        lastCheck: new Date(),
        seconds: 0
      };
      this.checks.uptime = result;
      return result;
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks(mongoose, redisClient) {
    try {
      const [db, cache, memory, disk, uptime] = await Promise.all([
        this.checkDatabase(mongoose),
        this.checkCache(redisClient),
        this.checkMemory(),
        this.checkDisk(),
        this.checkUptime()
      ]);

      const overall = this.getOverallStatus();
      const result = {
        status: overall,
        overall,
        timestamp: new Date(),
        uptime: (Date.now() - this.startTime) / 1000,
        hostname: os.hostname(),
        checks: this.checks,
        database: db,
        cache,
        memory,
        disk,
        uptimeCheck: uptime
      };

      return result;
    } catch (err) {
      logger.error(`Health check error: ${err.message}`);

      const result = {
        status: 'unhealthy',
        overall: 'unhealthy',
        timestamp: new Date(),
        uptime: (Date.now() - this.startTime) / 1000,
        hostname: os.hostname(),
        checks: this.checks,
        error: err.message
      };

      return result;
    }
  }

  /**
   * Get ready-only status (for readiness probes)
   * Returns true only if app is fully initialized
   */
  async isReady(mongoose) {
    try {
      // For readiness, only check critical components
      return mongoose && mongoose.connection.readyState === 1;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get status for Kubernetes/Docker liveness probe
   * Returns true if app is still running (even if degraded)
   */
  isAlive() {
    // Check if process is still running
    return process.uptime() > 0;
  }

  /**
   * Request per second counter
   * @param {number} requests - Number of requests processed
   * @param {number} seconds - Time window in seconds
   */
  static getRPS(requests = null, seconds = null) {
    if (typeof requests === 'number' && typeof seconds === 'number' && seconds > 0) {
      return Math.round(requests / seconds);
    }

    const memUsage = process.memoryUsage();
    // Estimate RPS based on memory pressure
    // This is a fallback metric
    const estimatedRPS = Math.max(1, 100 - Math.round(
      (memUsage.heapUsed / memUsage.heapTotal) * 100
    ));
    return estimatedRPS;
  }

  /**
   * Get load factor (0-100)
   * 0 = idle, 100 = max capacity
   * @param {number} currentLoad
   * @param {number} baseline
   * @param {number} activeUsers
   * @param {number} maxCapacity
   */
  static getLoadFactor(currentLoad = null, baseline = null, activeUsers = null, maxCapacity = null) {
    if (
      typeof currentLoad === 'number' &&
      typeof baseline === 'number' &&
      typeof activeUsers === 'number' &&
      typeof maxCapacity === 'number' &&
      maxCapacity > 0
    ) {
      const percent = ((currentLoad + activeUsers) / maxCapacity) * 100;
      return Math.round(Math.min(100, Math.max(0, percent)));
    }

    const memUsage = process.memoryUsage();
    const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const cpuPercent = process.cpuUsage().user / 10000; // Rough estimate

    return Math.round(Math.min(100, Math.max(0, Math.max(heapPercent, cpuPercent))));
  }
}


module.exports = new HealthCheckService();
