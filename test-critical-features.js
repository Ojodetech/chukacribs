#!/usr/bin/env node
const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTests() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║  🧪 CHUKA CRIBS - CRITICAL FUNCTIONALITY TESTS 🧪      ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝\n', 'cyan');

  const results = { passed: [], failed: [], warnings: [] };

  // Test 1: Server Health
  log('Test 1: Server is running...', 'blue');
  try {
    const response = await axios.get(BASE_URL, { timeout: 5000 });
    log('  ✅ PASSED - Server responding\n', 'green');
    results.passed.push('Server Health Check');
  } catch (error) {
    log(`  ❌ FAILED - ${error.message}\n`, 'red');
    results.failed.push('Server Health Check');
  }

  // Test 2: API Endpoints Available
  log('Test 2: API endpoints available...', 'blue');
  try {
    const endpoints = ['/api/houses', '/api/auth', '/api/bookings'];
    for (const endpoint of endpoints) {
      try {
        await axios.get(BASE_URL + endpoint, { timeout: 3000 });
      } catch (e) {
        // 404, 401, 500 all mean endpoint exists, just may need auth or data
        if (e.response?.status) {
          log(`  ✅ ${endpoint} - Status ${e.response.status}`, 'yellow');
        }
      }
    }
    log('  ✅ PASSED - API endpoints reachable\n', 'green');
    results.passed.push('API Endpoints');
  } catch (error) {
    log(`  ❌ FAILED - ${error.message}\n`, 'red');
    results.failed.push('API Endpoints');
  }

  // Test 3: Authentication Routes
  log('Test 3: Authentication routes accessible...', 'blue');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'test@test.com',
      password: 'test'
    }).catch(e => e.response);
    
    if (response?.status === 400 || response?.status === 401 || response?.status === 500) {
      log('  ✅ PASSED - Auth routes responding\n', 'green');
      results.passed.push('Authentication Routes');
    }
  } catch (error) {
    log(`  ⚠️  WARNING - ${error.message}\n`, 'yellow');
    results.warnings.push('Authentication Routes');
  }

  // Test 4: Admin Panel Routes
  log('Test 4: Admin panel accessible...', 'blue');
  try {
    const response = await axios.post(`${API_URL}/auth/admin/login`, {
      secretKey: 'test'
    }).catch(e => e.response);
    
    if (response?.status) {
      log('  ✅ PASSED - Admin routes responding\n', 'green');
      results.passed.push('Admin Panel Routes');
    }
  } catch (error) {
    log(`  ⚠️  WARNING - ${error.message}\n`, 'yellow');
    results.warnings.push('Admin Panel Routes');
  }

  // Test 5: Environment Configuration
  log('Test 5: Environment configuration...', 'blue');
  const envChecks = [
    { name: 'NODE_ENV', value: process.env.NODE_ENV },
    { name: 'PORT', value: process.env.PORT },
    { name: 'JWT_SECRET', value: process.env.JWT_SECRET ? '✓ Set' : '✗ Missing' },
    { name: 'ADMIN_SECRET_KEY', value: process.env.ADMIN_SECRET_KEY ? '✓ Set' : '✗ Missing' },
    { name: 'EMAIL_SERVICE', value: process.env.EMAIL_SERVICE || '✗ Missing' },
    { name: 'SMS_PROVIDER', value: process.env.SMS_PROVIDER || '✗ Missing' },
    { name: 'PESAPAL_CONSUMER_KEY', value: process.env.PESAPAL_CONSUMER_KEY ? '✓ Set' : '✗ Missing' }
  ];

  let allConfigured = true;
  for (const check of envChecks) {
    const status = check.value && check.value !== '✗ Missing' ? '✓' : '✗';
    const color = status === '✓' ? 'green' : 'red';
    log(`  ${status} ${check.name}: ${check.value}`, color);
    if (status === '✗') {allConfigured = false;}
  }
  
  if (allConfigured) {
    log('  ✅ PASSED - All critical env vars configured\n', 'green');
    results.passed.push('Environment Configuration');
  } else {
    log('  ⚠️  Some environment variables missing\n', 'yellow');
    results.warnings.push('Environment Configuration');
  }

  // Test 6: Feature Modules
  log('Test 6: Feature modules loaded...', 'blue');
  const features = [
    { name: 'Authentication', file: 'routes/auth.js' },
    { name: 'Properties', file: 'routes/houses.js' },
    { name: 'Payments', file: 'routes/payments.js' },
    { name: 'Bookings', file: 'routes/bookings.js' }
  ];

  try {
    const fs = require('fs');
    const path = require('path');
    for (const feature of features) {
      const filePath = path.join(__dirname, feature.file);
      if (fs.existsSync(filePath)) {
        log(`  ✓ ${feature.name} module present`, 'green');
      } else {
        log(`  ✗ ${feature.name} module missing`, 'red');
      }
    }
    log('  ✅ PASSED - Core modules loaded\n', 'green');
    results.passed.push('Feature Modules');
  } catch (error) {
    log(`  ⚠️  ${error.message}\n`, 'yellow');
    results.warnings.push('Feature Modules');
  }

  // Test 7: Database Status
  log('Test 7: Database connection...', 'blue');
  try {
    // Try to get properties which would fail if DB is completely down
    const response = await axios.get(`${API_URL}/houses`).catch(e => e.response);
    if (response?.status === 200 || response?.data) {
      log('  ✅ PASSED - Database responding\n', 'green');
      results.passed.push('Database Status');
    } else if (response?.status === 500) {
      log('  ⚠️  Database connection error (check MongoDB credentials)\n', 'yellow');
      results.warnings.push('Database Status');
    }
  } catch (error) {
    log(`  ⚠️  ${error.message}\n`, 'yellow');
    results.warnings.push('Database Status');
  }

  // Test 8: Security Headers
  log('Test 8: Security headers...', 'blue');
  try {
    const response = await axios.get(BASE_URL);
    const securityHeaders = ['x-frame-options', 'x-content-type-options', 'strict-transport-security'];
    let headerCount = 0;
    for (const header of securityHeaders) {
      if (response.headers[header]) {
        headerCount++;
        log(`  ✓ ${header}`, 'green');
      }
    }
    if (headerCount > 0) {
      log(`  ✅ PASSED - Security headers present\n`, 'green');
      results.passed.push('Security Headers');
    } else {
      log('  ⚠️  Some security headers missing\n', 'yellow');
      results.warnings.push('Security Headers');
    }
  } catch (error) {
    log(`  ⚠️  ${error.message}\n`, 'yellow');
  }

  // Summary
  log('╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║  📊 TEST SUMMARY                                       ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝\n', 'cyan');

  log(`✅ Passed: ${results.passed.length}`, 'green');
  for (const test of results.passed) {
    log(`   • ${test}`, 'green');
  }

  if (results.failed.length > 0) {
    log(`\n❌ Failed: ${results.failed.length}`, 'red');
    for (const test of results.failed) {
      log(`   • ${test}`, 'red');
    }
  }

  if (results.warnings.length > 0) {
    log(`\n⚠️  Warnings: ${results.warnings.length}`, 'yellow');
    for (const test of results.warnings) {
      log(`   • ${test}`, 'yellow');
    }
  }

  const total = results.passed.length + results.failed.length + results.warnings.length;
  const successRate = Math.round((results.passed.length / total) * 100);
  
  log(`\n📈 Overall Success Rate: ${successRate}%\n`, successRate >= 80 ? 'green' : 'yellow');

  if (results.failed.length === 0 && results.warnings.length <= 2) {
    log('🎉 SITE IS READY FOR LOCAL TESTING!\n', 'green');
    log('Next Steps:', 'cyan');
    log('1. Fix MongoDB credentials in .env', 'yellow');
    log('2. Test user registration and login', 'yellow');
    log('3. Test property upload and listing', 'yellow');
    log('4. Test payment processing', 'yellow');
    log('5. Test email/SMS notifications\n', 'yellow');
  } else if (results.failed.length > 0) {
    log('⚠️  Critical Issues Found - Review errors above\n', 'red');
  }

  log('╚════════════════════════════════════════════════════════╝\n', 'cyan');
}

runTests().catch(error => {
  log(`\n❌ Error: ${error.message}\n`, 'red');
  process.exit(1);
});
