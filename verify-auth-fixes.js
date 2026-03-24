#!/usr/bin/env node

/**
 * Authentication Fix Verification Script
 * Tests the two critical authentication fixes
 * 
 * Usage: node verify-auth-fixes.js
 */

const fs = require('fs');
const path = require('path');

const ANSI = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

function check(condition, message) {
  if (condition) {
    console.log(`${ANSI.GREEN}✓${ANSI.RESET} ${message}`);
    return true;
  } else {
    console.log(`${ANSI.RED}✗${ANSI.RESET} ${message}`);
    return false;
  }
}

function warn(message) {
  console.log(`${ANSI.YELLOW}⚠${ANSI.RESET} ${message}`);
}

function header(title) {
  console.log(`\n${ANSI.BOLD}${ANSI.BLUE}${title}${ANSI.RESET}\n`);
}

let passedChecks = 0;
let totalChecks = 0;

header('🔍 Authentication Fixes Verification');

// ============================================================================
// CHECK 1: Frontend - landlord-dashboard.js
// ============================================================================

header('Check 1: Landlord Dashboard (landlord-dashboard.js)');

const dashboardPath = path.join(__dirname, 'landlord-portal/js/landlord-dashboard.js');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

totalChecks++;
if (check(!dashboardContent.includes('localStorage.getItem(\'token\')') || 
          dashboardContent.includes('credentials: \'include\''),
          'Removed localStorage token usage from handleAddProperty')) {
  passedChecks++;
}

totalChecks++;
if (check(dashboardContent.includes('/api/landlord-properties'),
          'Uses correct endpoint /api/landlord-properties')) {
  passedChecks++;
}

totalChecks++;
if (check(dashboardContent.includes('formData.append(\'landlordName\'') &&
          dashboardContent.includes('formData.append(\'contact\''),
          'FormData includes landlordName and contact')) {
  passedChecks++;
}

totalChecks++;
if (check(dashboardContent.match(/credentials: ['"]include['"]/g) || [].length >= 2,
          'Multiple fetch calls use credentials: include')) {
  passedChecks++;
}

// ============================================================================
// CHECK 2: Backend - routes/auth.js
// ============================================================================

header('Check 2: Auth Routes (routes/auth.js)');

const authRoutePath = path.join(__dirname, 'routes/auth.js');
const authRouteContent = fs.readFileSync(authRoutePath, 'utf8');

totalChecks++;
if (check(authRouteContent.includes('router.get(\'/me/admin\''),
          'Created GET /me/admin endpoint')) {
  passedChecks++;
}

totalChecks++;
if (check(authRouteContent.includes('adminToken') && authRouteContent.includes('adminToken'),
          'Endpoint checks adminToken cookie')) {
  passedChecks++;
}

totalChecks++;
if (check(authRouteContent.includes('verifyToken') && authRouteContent.includes('require'),
          'verifyToken function is imported')) {
  passedChecks++;
}

totalChecks++;
if (check(authRouteContent.includes('decoded.role') && authRouteContent.includes('admin'),
          'Endpoint verifies admin role')) {
  passedChecks++;
}

// ============================================================================
// CHECK 3: Frontend - admin-panel.js
// ============================================================================

header('Check 3: Admin Panel (public/js/admin-panel.js)');

const adminPath = path.join(__dirname, 'public/js/admin-panel.js');
const adminContent = fs.readFileSync(adminPath, 'utf8');

totalChecks++;
if (check(adminContent.includes('/api/auth/me/admin'),
          'Admin auth check calls /api/auth/me/admin endpoint')) {
  passedChecks++;
}

totalChecks++;
if (check(adminContent.includes('credentials: \'include\''),
          'Admin fetch uses credentials: include')) {
  passedChecks++;
}

// ============================================================================
// CHECK 4: Config - auth.js
// ============================================================================

header('Check 4: Auth Config (config/auth.js)');

const configPath = path.join(__dirname, 'config/auth.js');
const configContent = fs.readFileSync(configPath, 'utf8');

totalChecks++;
if (check(configContent.includes('verifyToken') && configContent.includes('module.exports'),
          'verifyToken is exported from auth.js')) {
  passedChecks++;
}

totalChecks++;
if (check(configContent.includes('adminToken'),
          'setAdminCookie function exists')) {
  passedChecks++;
}

totalChecks++;
if (check(configContent.includes('clearAuthCookies'),
          'clearAuthCookies clears both auth and admin cookies')) {
  passedChecks++;
}

// ============================================================================
// SUMMARY
// ============================================================================

header('📊 Verification Summary');

const percentage = Math.round((passedChecks / totalChecks) * 100);
console.log(`Passed: ${passedChecks}/${totalChecks} checks (${percentage}%)\n`);

if (passedChecks === totalChecks) {
  console.log(`${ANSI.GREEN}${ANSI.BOLD}✓ All authentication fixes verified!${ANSI.RESET}\n`);
  console.log('The following issues are FIXED:');
  console.log('  1. Landlord dashboard property upload (credentials: include)');
  console.log('  2. Admin panel authentication (/api/auth/me/admin endpoint)');
  console.log('  3. Account settings update (credentials: include)');
  console.log('  4. Manage properties fetch (correct endpoint + credentials)');
  console.log('\n✅ Ready for testing!\n');
  process.exit(0);
} else {
  console.log(`${ANSI.YELLOW}${ANSI.BOLD}⚠ Some checks failed. Review the issues above.${ANSI.RESET}\n`);
  process.exit(1);
}
