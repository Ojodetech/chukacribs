/**
 * Feature Flags & API Versioning Admin Routes
 */

const express = require('express');
const router = express.Router();
const { featureFlagManager } = require('../config/featureFlags');
const { apiVersionManager } = require('../config/versionManager');

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

// ============================================================================
// FEATURE FLAGS ENDPOINTS
// ============================================================================

/**
 * GET /api/feature-flags
 * List all feature flags
 */
router.get('/feature-flags', (req, res) => {
  try {
    const flags = featureFlagManager.getAllFlags();
    res.json({
      success: true,
      flags,
      count: Object.keys(flags).length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/feature-flags/:flagName
 * Get specific feature flag info
 */
router.get('/feature-flags/:flagName', (req, res) => {
  try {
    const flag = featureFlagManager.getFlag(req.params.flagName);
    if (!flag) {
      return res.status(404).json({ success: false, error: 'Flag not found' });
    }
    res.json({ success: true, flag });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/feature-flags
 * Create new feature flag
 */
router.post('/feature-flags', (req, res) => {
  try {
    const { flagName, enabled, rolloutPercentage, description, owner } = req.body;
    
    if (!flagName) {
      return res.status(400).json({ success: false, error: 'flagName required' });
    }

    featureFlagManager.createFlag(flagName, {
      enabled: enabled || false,
      rolloutPercentage: rolloutPercentage || 0,
      description: description || '',
      owner: owner || 'unassigned'
    });

    res.json({
      success: true,
      message: `Flag ${flagName} created`,
      flag: featureFlagManager.getFlag(flagName)
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/feature-flags/:flagName/rollout
 * Update flag rollout percentage
 */
router.put('/feature-flags/:flagName/rollout', (req, res) => {
  try {
    const { percentage } = req.body;
    
    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'Percentage must be 0-100' 
      });
    }

    featureFlagManager.updateRolloutPercentage(req.params.flagName, percentage);
    
    res.json({
      success: true,
      message: `Rollout updated to ${percentage}%`,
      flag: featureFlagManager.getFlag(req.params.flagName)
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/feature-flags/:flagName/enable
 * Enable feature flag
 */
router.put('/feature-flags/:flagName/enable', (req, res) => {
  try {
    featureFlagManager.setFlagEnabled(req.params.flagName, true);
    res.json({
      success: true,
      message: `Flag ${req.params.flagName} enabled`,
      flag: featureFlagManager.getFlag(req.params.flagName)
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/feature-flags/:flagName/disable
 * Disable feature flag
 */
router.put('/feature-flags/:flagName/disable', (req, res) => {
  try {
    featureFlagManager.setFlagEnabled(req.params.flagName, false);
    res.json({
      success: true,
      message: `Flag ${req.params.flagName} disabled`,
      flag: featureFlagManager.getFlag(req.params.flagName)
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/feature-flags/:flagName/segment
 * Add user to feature segment (instant rollout)
 */
router.post('/feature-flags/:flagName/segment', (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }

    featureFlagManager.addUserToSegment(userId, req.params.flagName);
    
    res.json({
      success: true,
      message: `User ${userId} added to ${req.params.flagName}`,
      segmentMembers: featureFlagManager.getSegmentMembers(req.params.flagName)
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/feature-flags/:flagName/segment/:userId
 * Remove user from feature segment
 */
router.delete('/feature-flags/:flagName/segment/:userId', (req, res) => {
  try {
    featureFlagManager.removeUserFromSegment(req.params.userId, req.params.flagName);
    
    res.json({
      success: true,
      message: `User ${req.params.userId} removed from ${req.params.flagName}`,
      segmentMembers: featureFlagManager.getSegmentMembers(req.params.flagName)
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/feature-flags/:flagName/rollout-plan
 * Get gradual rollout plan
 */
router.get('/feature-flags/:flagName/rollout-plan', (req, res) => {
  try {
    const { targetPercentage = 100, steps = 5 } = req.query;
    const plan = featureFlagManager.getGradualRolloutPlan(
      req.params.flagName,
      parseInt(targetPercentage),
      parseInt(steps)
    );
    res.json({ success: true, plan });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/feature-flags/:flagName/ab-results
 * Get A/B test results
 */
router.get('/feature-flags/:flagName/ab-results', (req, res) => {
  try {
    const results = featureFlagManager.getABTestResults(req.params.flagName);
    res.json({ success: true, results });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/feature-flags/audit-log
 * Get audit log
 */
router.get('/feature-flags/:flagName/audit', (req, res) => {
  try {
    const log = featureFlagManager.getAuditLog(req.params.flagName);
    res.json({ success: true, entries: log });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================================================
// API VERSIONING ENDPOINTS
// ============================================================================

/**
 * GET /api/version
 * Get API version information
 */
router.get('/version', (req, res) => {
  res.json({
    success: true,
    ...apiVersionManager.getVersionEndpoint()
  });
});

/**
 * GET /api/version/check
 * Check if version is valid
 */
router.get('/version/check', (req, res) => {
  const { version } = req.query;
  
  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'version query parameter required'
    });
  }

  const isValid = apiVersionManager.isValidVersion(version);
  res.json({
    success: true,
    version,
    valid: isValid,
    supported: apiVersionManager.supportedVersions,
    message: isValid ? `${version} is supported` : `${version} is not supported`
  });
});

module.exports = router;
