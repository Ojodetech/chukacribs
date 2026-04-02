/**
 * API Versioning System
 * 
 * Implements URL-based versioning for safe backward compatibility
 * - /api/v1/* - Stable API (current production)
 * - /api/v2/* - Upcoming features, breaking changes safe
 * - Routes support both versions simultaneously
 * 
 * Usage:
 * Old clients: GET /api/v1/houses
 * New clients: GET /api/v2/houses (enhanced response)
 */

const express = require('express');

/**
 * API Version Manager
 */
class APIVersionManager {
  constructor() {
    this.versions = new Map();
    this.currentVersion = 'v1';
    this.supportedVersions = ['v1', 'v2'];
    this.deprecatedVersions = new Set();
    this.versionRoutes = new Map();
  }

  /**
   * Register versioned routes
   */
  registerVersion(version, path, handler) {
    const key = `${version}:${path}`;
    this.versionRoutes.set(key, handler);
  }

  /**
   * Get handler for specific version
   */
  getHandler(version, path) {
    const key = `${version}:${path}`;
    return this.versionRoutes.get(key);
  }

  /**
   * Mark version as deprecated (still works, but warn clients)
   */
  deprecateVersion(version, sunsetDate) {
    this.deprecatedVersions.add({
      version,
      sunsetDate: new Date(sunsetDate),
      message: `API version ${version} will be sunset on ${sunsetDate}. Please migrate to ${this.currentVersion}.`
    });
  }

  /**
   * Get version info
   */
  getVersionInfo() {
    return {
      current: this.currentVersion,
      supported: this.supportedVersions,
      deprecated: Array.from(this.deprecatedVersions).map(d => ({
        version: d.version,
        sunsetDate: d.sunsetDate.toISOString(),
        message: d.message
      }))
    };
  }

  /**
   * Check if version is valid
   */
  isValidVersion(version) {
    return this.supportedVersions.includes(version);
  }

  /**
   * Create version router middleware
   */
  createVersionRouter() {
    const router = express.Router();

    // Middleware to set version
    router.use((req, res, next) => {
      // Extract version from URL: /api/v1/* -> v1
      const versionMatch = req.path.match(/^\/v(\d+)(\/|$)/);
      if (!versionMatch) {
        return res.status(400).json({
          success: false,
          error: 'Invalid API request. Use /api/v1/* or /api/v2/*',
          supportedVersions: this.supportedVersions,
          learnMore: '/api/version'
        });
      }

      const version = `v${versionMatch[1]}`;
      
      if (!this.isValidVersion(version)) {
        return res.status(410).json({
          success: false,
          error: `API version ${version} is no longer supported`,
          current: this.currentVersion,
          supported: this.supportedVersions
        });
      }

      // Add deprecation warning header if applicable
      for (const deprecated of this.deprecatedVersions) {
        if (deprecated.version === version) {
          res.setHeader('Deprecated', 'true');
          res.setHeader('Sunset', deprecated.sunsetDate.toUTCString());
          res.setHeader('Warning', `299 - "${deprecated.message}"`);
        }
      }

      req.apiVersion = version;
      next();
    });

    return router;
  }

  /**
   * Get version endpoint data
   */
  getVersionEndpoint() {
    return {
      current: this.currentVersion,
      supported: this.supportedVersions,
      deprecated: Array.from(this.deprecatedVersions).map(d => ({
        version: d.version,
        sunsetDate: d.sunsetDate.toISOString(),
        message: d.message
      })),
      changeLog: {
        v1: 'Initial API release',
        v2: 'Enhanced endpoints, improved filtering, new bulk operations'
      },
      migration: {
        guide: '/docs/migration-guide',
        support: 'support@chukacribs.co.ke'
      }
    };
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

const apiVersionManager = new APIVersionManager();

module.exports = {
  apiVersionManager,
  APIVersionManager
};
