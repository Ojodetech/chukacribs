/**
 * Load Balancer Configuration (#10: Horizontal Scaling)
 * Manages traffic distribution across multiple application instances
 * Supports least connection, round-robin, and weighted strategies
 */

const crypto = require('crypto');

class LoadBalancer {
  constructor(options = {}) {
    this.strategy = options.strategy || 'round-robin'; // round-robin, least-connection, weighted, ip-hash
    this.instances = [];
    this.currentIndex = 0;
    this.healthChecks = new Map();
    this.sessionAffinity = options.sessionAffinity || false;
    this.sessionTimeout = options.sessionTimeout || 3600000; // 1 hour
    this.sessionMap = new Map();
    this.updateInterval = options.updateInterval || 30000;
    
    // Health check configuration
    this.healthCheckConfig = {
      interval: options.healthCheckInterval || 5000,
      timeout: options.healthCheckTimeout || 2000,
      unhealthyThreshold: options.unhealthyThreshold || 3,
      healthyThreshold: options.healthyThreshold || 2
    };

    this.startHealthChecks();
  }

  /**
   * Register an application instance
   */
  addInstance(instance) {
    const newInstance = {
      id: instance.id || crypto.randomBytes(8).toString('hex'),
      host: instance.host,
      port: instance.port,
      weight: instance.weight || 1,
      healthy: true,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      totalRequests: 0,
      activeConnections: 0,
      responseTime: 0,
      lastHealthCheck: Date.now(),
      startedAt: Date.now()
    };

    this.instances.push(newInstance);
    this.healthChecks.set(newInstance.id, newInstance);
    return newInstance.id;
  }

  /**
   * Remove an instance from the load balancer
   */
  removeInstance(instanceId) {
    this.instances = this.instances.filter(inst => inst.id !== instanceId);
    this.healthChecks.delete(instanceId);
  }

  /**
   * Get next instance based on strategy
   */
  getNextInstance(sessionId = null) {
    const healthyInstances = this.instances.filter(inst => inst.healthy);
    
    if (healthyInstances.length === 0) {
      throw new Error('No healthy instances available');
    }

    // Session affinity
    if (this.sessionAffinity && sessionId) {
      const cachedInstance = this.sessionMap.get(sessionId);
      if (cachedInstance && cachedInstance.healthy) {
        cachedInstance.activeConnections++;
        return cachedInstance;
      }
    }

    let instance;

    switch (this.strategy) {
      case 'round-robin':
        instance = this.roundRobin(healthyInstances);
        break;
      case 'least-connection':
        instance = this.leastConnection(healthyInstances);
        break;
      case 'weighted':
        instance = this.weightedRoundRobin(healthyInstances);
        break;
      case 'ip-hash':
        instance = this.ipHash(healthyInstances, sessionId);
        break;
      default:
        instance = this.roundRobin(healthyInstances);
    }

    if (this.sessionAffinity && sessionId) {
      this.sessionMap.set(sessionId, instance);
      const timeout = setTimeout(() => this.sessionMap.delete(sessionId), this.sessionTimeout);
      instance.sessionTimeouts = instance.sessionTimeouts || [];
      instance.sessionTimeouts.push(timeout);
    }

    instance.activeConnections++;
    instance.totalRequests++;
    return instance;
  }

  /**
   * Round-robin strategy
   */
  roundRobin(instances) {
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex++;
    return instance;
  }

  /**
   * Least connection strategy
   */
  leastConnection(instances) {
    return instances.reduce((min, inst) => 
      inst.activeConnections < min.activeConnections ? inst : min
    );
  }

  /**
   * Weighted round-robin strategy
   */
  weightedRoundRobin(instances) {
    const totalWeight = instances.reduce((sum, inst) => sum + inst.weight, 0);
    let random = Math.random() * totalWeight;

    for (let instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }

    return instances[0];
  }

  /**
   * IP hash strategy (consistent hashing)
   */
  ipHash(instances, key) {
    const hash = crypto.createHash('md5').update(key || '').digest('hex');
    const index = parseInt(hash, 16) % instances.length;
    return instances[index];
  }

  /**
   * Release connection from instance
   */
  releaseConnection(instance, responseTime = 0) {
    if (instance) {
      instance.activeConnections = Math.max(0, instance.activeConnections - 1);
      instance.responseTime = responseTime;
    }
  }

  /**
   * Perform health checks on all instances
   */
  startHealthChecks() {
    setInterval(() => {
      this.instances.forEach(instance => {
        this.checkInstanceHealth(instance);
      });
    }, this.healthCheckConfig.interval);
  }

  /**
   * Check health of a single instance
   */
  async checkInstanceHealth(instance) {
    try {
      const http = require('http');
      const url = `http://${instance.host}:${instance.port}/health`;
      
      const req = http.get(url, { timeout: this.healthCheckConfig.timeout }, (res) => {
        if (res.statusCode === 200) {
          instance.consecutiveSuccesses++;
          instance.consecutiveFailures = 0;

          if (instance.consecutiveSuccesses >= this.healthCheckConfig.healthyThreshold) {
            instance.healthy = true;
          }
        } else {
          this.markUnhealthy(instance);
        }
        instance.lastHealthCheck = Date.now();
      });

      req.on('error', () => {
        this.markUnhealthy(instance);
        instance.lastHealthCheck = Date.now();
      });

      req.on('timeout', () => {
        req.destroy();
        this.markUnhealthy(instance);
        instance.lastHealthCheck = Date.now();
      });
    } catch (error) {
      this.markUnhealthy(instance);
    }
  }

  /**
   * Mark instance as unhealthy
   */
  markUnhealthy(instance) {
    instance.consecutiveFailures++;
    instance.consecutiveSuccesses = 0;

    if (instance.consecutiveFailures >= this.healthCheckConfig.unhealthyThreshold) {
      instance.healthy = false;
    }
  }

  /**
   * Get load balancer statistics
   */
  getStats() {
    return {
      strategy: this.strategy,
      totalInstances: this.instances.length,
      healthyInstances: this.instances.filter(i => i.healthy).length,
      unhealthyInstances: this.instances.filter(i => !i.healthy).length,
      instances: this.instances.map(inst => ({
        id: inst.id,
        host: inst.host,
        port: inst.port,
        healthy: inst.healthy,
        activeConnections: inst.activeConnections,
        totalRequests: inst.totalRequests,
        responseTime: `${inst.responseTime.toFixed(2)}ms`,
        uptime: `${Math.floor((Date.now() - inst.startedAt) / 1000)}s`,
        lastHealthCheck: new Date(inst.lastHealthCheck).toISOString()
      })),
      totalActiveConnections: this.instances.reduce((sum, i) => sum + i.activeConnections, 0),
      totalRequests: this.instances.reduce((sum, i) => sum + i.totalRequests, 0)
    };
  }

  /**
   * Graceful shutdown of an instance
   */
  gracefulShutdown(instanceId) {
    const instance = this.instances.find(i => i.id === instanceId);
    if (instance) {
      instance.healthy = false;
      
      // Wait for active connections to close
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (instance.activeConnections === 0) {
            clearInterval(checkInterval);
            this.removeInstance(instanceId);
            resolve();
          }
        }, 100);
      });
    }
  }
}

module.exports = LoadBalancer;
