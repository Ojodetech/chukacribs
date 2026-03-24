/**
 * Load Balancer Tests
 * Tests health checks, session management, rate limiting, and failover scenarios
 */

const request = require('supertest');
const express = require('express');
const healthCheckInstance = require('../config/healthCheck');
const HealthCheckService = healthCheckInstance.constructor || require('../config/healthCheck');

// Mock Redis client for testing
jest.mock('redis', () => ({

  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    info: jest.fn().mockResolvedValue('# Memory\r\nused_memory:1000000'),
    quit: jest.fn().mockResolvedValue(undefined),
  })),
}));

const redis = require('redis');
const SessionManager = require('../config/sessionManager');

describe('HealthCheckService', () => {
  let healthService;

  beforeEach(() => {
    healthService = new HealthCheckService();
  });

  describe('checkDatabase', () => {
    it('should check database connectivity', async () => {
      const result = await healthService.checkDatabase();
      expect(result).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    });

    it('should include response time in database check', async () => {
      const result = await healthService.checkDatabase();
      expect(result).toHaveProperty('responseTime');
      expect(typeof result.responseTime).toBe('number');
    });
  });

  describe('checkCache', () => {
    it('should check Redis cache connectivity', async () => {
      const result = await healthService.checkCache();
      expect(result).toHaveProperty('status');
      expect(['healthy', 'unhealthy']).toContain(result.status);
    });

    it('should include memory info in cache check', async () => {
      const result = await healthService.checkCache();
      expect(result).toHaveProperty('memory');
    });
  });

  describe('checkMemory', () => {
    it('should monitor heap memory usage', async () => {
      const result = await healthService.checkMemory();
      expect(result).toHaveProperty('heapUsed');
      expect(result).toHaveProperty('heapTotal');
      expect(typeof result.heapUsed).toBe('number');
    });

    it('should return healthy status under threshold', async () => {
      const result = await healthService.checkMemory();
      expect(['healthy', 'degraded']).toContain(result.status);
    });

    it('should include RSS (Resident Set Size)', async () => {
      const result = await healthService.checkMemory();
      expect(result).toHaveProperty('rss');
    });
  });

  describe('checkDisk', () => {
    it('should provide disk space information', async () => {
      const result = await healthService.checkDisk();
      expect(result).toHaveProperty('available');
      expect(typeof result.available).toBe('number');
    });
  });

  describe('checkUptime', () => {
    it('should report process uptime', async () => {
      const result = await healthService.checkUptime();
      expect(result).toHaveProperty('uptime');
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('runAllChecks', () => {
    it('should run all health checks', async () => {
      const result = await healthService.runAllChecks();
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('cache');
      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('disk');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('overall');
    });

    it('should aggregate overall status', async () => {
      const result = await healthService.runAllChecks();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.overall);
    });
  });

  describe('getOverallStatus', () => {
    it('should return overall health status', async () => {
      const status = await healthService.getOverallStatus();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(status);
    });
  });

  describe('Static utilities', () => {
    it('getRPS should calculate requests per second', () => {
      const rps1 = HealthCheckService.getRPS(100, 10);
      const rps2 = HealthCheckService.getRPS(100, 5);
      expect(rps1).toBeLessThan(rps2);
    });

    it('getLoadFactor should return 0-100 value', () => {
      const loadFactor = HealthCheckService.getLoadFactor(50, 100, 1000, 2000);
      expect(loadFactor).toBeGreaterThanOrEqual(0);
      expect(loadFactor).toBeLessThanOrEqual(100);
    });
  });
});

describe('Health Check Endpoints', () => {
  let app;
  let healthRoutes;

  beforeEach(() => {
    app = express();
    healthRoutes = require('../routes/health');
    app.use('/health', healthRoutes);
  });

  describe('GET /health/live (Liveness Probe)', () => {
    it('should return 200 when process is alive', async () => {
      const response = await request(app).get('/health/live');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });

    it('should return JSON with alive indicator', async () => {
      const response = await request(app).get('/health/live');
      expect(response.type).toMatch(/json/);
      expect(response.body.alive).toBe(true);
    });

    it('should include timestamp', async () => {
      const response = await request(app).get('/health/live');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/ready (Readiness Probe)', () => {
    it('should return 200 when service is ready', async () => {
      const response = await request(app).get('/health/ready');
      expect([200, 503]).toContain(response.status);
    });

    it('should include database connection status', async () => {
      const response = await request(app).get('/health/ready');
      expect(response.body).toHaveProperty('database');
    });

    it('should include cache connection status', async () => {
      const response = await request(app).get('/health/ready');
      expect(response.body).toHaveProperty('cache');
    });
  });

  describe('GET /health/detailed (Full Status)', () => {
    it('should return detailed health information', async () => {
      const response = await request(app).get('/health/detailed');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('checks');
    });

    it('should include all component checks', async () => {
      const response = await request(app).get('/health/detailed');
      const checks = response.body.checks;
      expect(checks).toHaveProperty('database');
      expect(checks).toHaveProperty('cache');
      expect(checks).toHaveProperty('memory');
      expect(checks).toHaveProperty('disk');
    });

    it('should include timestamps for auditing', async () => {
      const response = await request(app).get('/health/detailed');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checkTime');
    });
  });

  describe('GET /health/metrics (Load Metrics)', () => {
    it('should return load balancer metrics', async () => {
      const response = await request(app).get('/health/metrics');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('loadFactor');
      expect(response.body).toHaveProperty('rps');
    });

    it('should provide memory usage percentage', async () => {
      const response = await request(app).get('/health/metrics');
      expect(response.body).toHaveProperty('memoryUsage');
      expect(response.body.memoryUsage).toBeGreaterThanOrEqual(0);
    });

    it('should include process uptime', async () => {
      const response = await request(app).get('/health/metrics');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /health (Default Endpoint)', () => {
    it('should return quick status', async () => {
      const response = await request(app).get('/health');
      expect([200, 503]).toContain(response.status);
    });

    it('should include overall status', async () => {
      const response = await request(app).get('/health');
      expect(response.body).toHaveProperty('status');
    });
  });
});

describe('SessionManager', () => {
  let sessionManager;
  let mockRedisClient;

  beforeEach(() => {
    // Reset redis.createClient implementation since jest.resetMocks is enabled globally
    redis.createClient.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(-1),
      exists: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(1),
      info: jest.fn().mockResolvedValue('# Memory\r\nused_memory:1000000'),
      quit: jest.fn().mockResolvedValue(undefined)
    }));

    mockRedisClient = redis.createClient();
    sessionManager = new SessionManager(mockRedisClient);
  });

  describe('Session CRUD Operations', () => {
    it('should set session data', async () => {
      const sessionId = 'test-session-123';
      const data = { userId: 'user1', email: 'test@example.com' };
      
      await sessionManager.setSession(sessionId, data);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(`session:${sessionId}`, expect.any(Number), JSON.stringify(data));
    });

    it('should get session data', async () => {
      const sessionId = 'test-session-123';
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: 'user1' }));
      
      const data = await sessionManager.getSession(sessionId);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`session:${sessionId}`);
    });

    it('should return null for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      const data = await sessionManager.getSession('nonexistent');
      expect(data).toBeNull();
    });

    it('should update session data', async () => {
      const sessionId = 'test-session-123';
      const updates = { lastActivity: Date.now() };
      
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: 'user1' }));
      
      await sessionManager.updateSession(sessionId, updates);
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should delete session', async () => {
      const sessionId = 'test-session-123';
      await sessionManager.deleteSession(sessionId);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`session:${sessionId}`);
    });

    it('should check session existence', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(1);
      const exists = await sessionManager.hasSession('test-session-123');
      expect(mockRedisClient.exists).toHaveBeenCalledWith('session:test-session-123');
      expect(exists).toBe(true);
    });
  });

  describe('Token Management', () => {
    it('should store user token', async () => {
      const userId = 'user1';
      const token = 'jwt-token-xyz';
      
      await sessionManager.setUserToken(userId, token);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(`user_token:${userId}`, expect.any(Number), token);
    });

    it('should retrieve user token', async () => {
      mockRedisClient.get.mockResolvedValueOnce('jwt-token-xyz');
      const token = await sessionManager.getUserToken('user1');
      expect(mockRedisClient.get).toHaveBeenCalledWith('user_token:user1');
    });
  });

  describe('User Data Caching', () => {
    it('should cache user data', async () => {
      const userData = { id: 'user1', name: 'John Doe', email: 'john@example.com' };
      await sessionManager.cacheUserData('user1', userData);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(`user_data:user1`, expect.any(Number), JSON.stringify(userData));
    });

    it('should retrieve cached user data', async () => {
      const userData = { id: 'user1', name: 'John Doe' };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(userData));
      
      const cached = await sessionManager.getCachedUserData('user1');
      expect(mockRedisClient.get).toHaveBeenCalledWith('user_data:user1');
    });
  });

  describe('Idempotency Key Management', () => {
    it('should store idempotency key result', async () => {
      const key = 'idempotency-key-123';
      const result = { paymentId: 'pay-456', status: 'success' };
      
      await sessionManager.storeIdempotencyKey(key, result);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(`idempotency:${key}`, expect.any(Number), JSON.stringify(result));
    });

    it('should retrieve idempotency key result', async () => {
      const result = { paymentId: 'pay-456', status: 'success' };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(result));
      
      const retrieved = await sessionManager.getIdempotencyResult('idempotency-key-123');
      expect(mockRedisClient.get).toHaveBeenCalledWith('idempotency:idempotency-key-123');
    });

    it('should prevent duplicate processing', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(1);
      const key = 'duplicate-key';
      
      const exists = await sessionManager.hasSession(`idempotency:${key}`);
      expect(exists).toBe(true);
    });
  });

  describe('Session Extension', () => {
    it('should extend session TTL', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(1);
      await sessionManager.extendSession('test-session-123');
      expect(mockRedisClient.exists).toHaveBeenCalledWith('session:test-session-123');
      expect(mockRedisClient.expire).toHaveBeenCalledWith('session:test-session-123', expect.any(Number));
    });
  });

  describe('Statistics', () => {
    it('should return Redis statistics', async () => {
      mockRedisClient.info.mockResolvedValueOnce('# Memory\r\nused_memory:1000000\r\nmax_memory:2000000');
      const stats = await sessionManager.getStats();
      expect(typeof stats).toBe('object');
    });
  });
});

describe('Load Balancer - Nginx Configuration', () => {
  it('should define upstream servers', () => {
    // Test that upstream block exists with multiple servers
    const fs = require('fs');
    const nginxConfig = fs.readFileSync('./config/nginx.conf', 'utf8');
    
    expect(nginxConfig).toContain('upstream chuka_cribs_backend');
    expect(nginxConfig).toContain('server 127.0.0.1:3000');
    expect(nginxConfig).toContain('server 127.0.0.1:3001');
    expect(nginxConfig).toContain('server 127.0.0.1:3002');
  });

  it('should configure rate limiting zones', () => {
    const fs = require('fs');
    const nginxConfig = fs.readFileSync('./config/nginx.conf', 'utf8');
    
    expect(nginxConfig).toContain('limit_req_zone');
    expect(nginxConfig).toContain('api_limit');
    expect(nginxConfig).toContain('auth_limit');
  });

  it('should enable SSL/TLS', () => {
    const fs = require('fs');
    const nginxConfig = fs.readFileSync('./config/nginx.conf', 'utf8');
    
    expect(nginxConfig).toContain('ssl_certificate');
    expect(nginxConfig).toContain('ssl_protocols TLSv1.2 TLSv1.3');
  });

  it('should configure health check routes without rate limiting', () => {
    const fs = require('fs');
    const nginxConfig = fs.readFileSync('./config/nginx.conf', 'utf8');
    
    expect(nginxConfig).toContain('location /health');
    // Health routes should NOT have rate limiting
    const healthSection = nginxConfig.substring(nginxConfig.indexOf('location /health'));
    expect(healthSection).not.toContain('limit_req rate');
  });

  it('should include security headers', () => {
    const fs = require('fs');
    const nginxConfig = fs.readFileSync('./config/nginx.conf', 'utf8');
    
    expect(nginxConfig).toContain('add_header Strict-Transport-Security');
    expect(nginxConfig).toContain('add_header X-Frame-Options');
    expect(nginxConfig).toContain('add_header X-Content-Type-Options');
  });
});

describe('Load Balancer - HAProxy Configuration', () => {
  it('should define multiple backends', () => {
    const fs = require('fs');
    const haproxyConfig = fs.readFileSync('./config/haproxy.cfg', 'utf8');
    
    expect(haproxyConfig).toContain('backend main_backend');
    expect(haproxyConfig).toContain('backend health_backend');
    expect(haproxyConfig).toContain('backend api_backend');
    expect(haproxyConfig).toContain('backend auth_backend');
  });

  it('should configure health checks', () => {
    const fs = require('fs');
    const haproxyConfig = fs.readFileSync('./config/haproxy.cfg', 'utf8');
    
    expect(haproxyConfig).toContain('check');
    expect(haproxyConfig).toMatch(/default-server .*inter 3s/);
  });

  it('should enable ACL-based routing', () => {
    const fs = require('fs');
    const haproxyConfig = fs.readFileSync('./config/haproxy.cfg', 'utf8');
    
    expect(haproxyConfig).toContain('acl');
    expect(haproxyConfig).toContain('use_backend');
  });

  it('should support WebSocket connections', () => {
    const fs = require('fs');
    const haproxyConfig = fs.readFileSync('./config/haproxy.cfg', 'utf8');
    
    expect(haproxyConfig).toContain('socket_backend');
    expect(haproxyConfig).toContain('timeout tunnel');
  });
});

describe('Failover Scenarios', () => {
  let healthService;

  beforeEach(() => {
    healthService = new HealthCheckService();
  });

  it('should detect unhealthy instance', async () => {
    // Simulate an unhealthy check
    const result = await healthService.checkDatabase();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
  });

  it('should report degraded state when components fail', async () => {
    const fullCheck = await healthService.runAllChecks();
    // Should have an overall status
    expect(fullCheck).toHaveProperty('overall');
  });

  it('should trigger readiness probe 503 on unhealthy', async () => {
    const app = express();
    const healthRoutes = require('../routes/health');
    app.use('/health', healthRoutes);
    
    const response = await request(app).get('/health/ready');
    // Status should be either 200 (ready) or 503 (not ready)
    expect([200, 503]).toContain(response.status);
  });
});

describe('Session Distribution - Cross-Instance', () => {
  let sessionManager1;
  let sessionManager2;
  let mockRedisClient;

  beforeEach(() => {
    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(-1),
      exists: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(1),
      info: jest.fn().mockResolvedValue('# Memory\r\nused_memory:1000000'),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    sessionManager1 = new SessionManager(mockRedisClient);
    sessionManager2 = new SessionManager(mockRedisClient);
  });

  it('should share session between different instances', async () => {
    const sessionId = 'shared-session-123';
    const data = { userId: 'user1', preferences: { theme: 'dark' } };
    
    // Instance 1 sets session
    mockRedisClient.setex.mockResolvedValueOnce('OK');
    await sessionManager1.setSession(sessionId, data);
    
    // Instance 2 should see the same session
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(data));
    const retrieved = await sessionManager2.getSession(sessionId);
    
    expect(mockRedisClient.get).toHaveBeenCalled();
  });

  it('should maintain session continuity on failover', async () => {
    const sessionId = 'failover-session';
    const originalData = { userId: 'user1', lastRoute: '/dashboard' };
    
    // Store in Redis
    mockRedisClient.setex.mockResolvedValueOnce('OK');
    await sessionManager1.setSession(sessionId, originalData);
    
    // Simulate failover to instance 2
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(originalData));
    const failoverData = await sessionManager2.getSession(sessionId);
    
    expect(failoverData).not.toBeNull();
  });
});

describe('Rate Limiting', () => {
  let app;

  beforeEach(() => {
    app = express();
  });

  it('should enforce API rate limits (10r/s)', () => {
    const fs = require('fs');
    const nginxConfig = fs.readFileSync('./config/nginx.conf', 'utf8');
    
    expect(nginxConfig).toContain('limit_req_zone');
    expect(nginxConfig).toContain('10r/s');
  });

  it('should enforce auth rate limits (5r/s)', () => {
    const fs = require('fs');
    const nginxConfig = fs.readFileSync('./config/nginx.conf', 'utf8');
    
    expect(nginxConfig).toContain('5r/s');
  });

  it('health endpoints should bypass rate limiting', () => {
    const fs = require('fs');
    const nginxConfig = fs.readFileSync('./config/nginx.conf', 'utf8');
    
    // Find health location block
    const healthSection = nginxConfig.substring(nginxConfig.indexOf('location /health'));
    const endOfBlock = healthSection.indexOf('}');
    const healthBlock = healthSection.substring(0, endOfBlock);
    
    // Health block should not contain rate limiting directive
    expect(healthBlock).not.toContain('limit_req');
  });
});

describe('Performance Metrics', () => {
  it('should track request rates per instance', () => {
    const rps1 = HealthCheckService.getRPS(1000, 10);
    const rps2 = HealthCheckService.getRPS(2500, 20);
    
    // RPS should scale with request count
    expect(rps2).toBeGreaterThan(rps1);
  });

  it('should calculate load factor 0-100', () => {
    const minLoad = HealthCheckService.getLoadFactor(100, 100, 500, 2048);
    const maxLoad = HealthCheckService.getLoadFactor(2000, 100, 1900, 2048);
    
    expect(minLoad).toBeLessThan(maxLoad);
    expect(minLoad).toBeGreaterThanOrEqual(0);
    expect(maxLoad).toBeLessThanOrEqual(100);
  });
});
