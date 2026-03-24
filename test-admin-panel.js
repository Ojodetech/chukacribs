#!/usr/bin/env node

/**
 * Admin Panel Integration Test
 * Tests all admin panel functionality
 */

const fetch = global.fetch || require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const ADMIN_SECRET_KEY = 'Ojode@123#3308';

// Store cookies for session management
let cookies = '';

async function test(name, fn) {
  try {
    console.log(`\n🧪 ${name}...`);
    await fn();
    console.log(`✅ PASSED`);
    return true;
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}`);
    return false;
  }
}

async function adminLogin() {
  const response = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ secretKey: ADMIN_SECRET_KEY })
  });

  if (!response.ok) {
    throw new Error(`Admin login failed with status ${response.status}`);
  }

  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    cookies = setCookieHeader.split(';')[0]; // Extract just the cookie value
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || 'Authentication failed');
  }

  console.log(`  ✅ Admin authenticated successfully`);
  return data;
}

async function getAdminStatus() {
  const response = await fetch(`${BASE_URL}/api/auth/me/admin`, {
    method: 'GET',
    headers: {
      'Cookie': cookies
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get admin status: ${response.status}`);
  }

  const data = await response.json();
  console.log(`  ✅ Admin status verified: role=${data.role}`);
  return data;
}

async function getPendingProperties() {
  const response = await fetch(`${BASE_URL}/api/houses/admin/pending`, {
    method: 'GET',
    headers: {
      'Cookie': cookies
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get pending properties: ${response.status}`);
  }

  const data = await response.json();
  console.log(`  ✅ Retrieved ${data.houses?.length || 0} pending properties`);
  return data;
}

async function adminLogout() {
  const response = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Cookie': cookies
    }
  });

  if (!response.ok) {
    throw new Error(`Logout failed with status ${response.status}`);
  }

  console.log(`  ✅ Admin logged out successfully`);
  return response.json();
}

async function runTests() {
  console.log('\n🚀 Starting Admin Panel Integration Tests...\n');
  
  const results = [];

  // Test 1: Admin Login
  results.push(await test('Admin Login', adminLogin));

  // Test 2: Get Admin Status
  results.push(await test('Get Admin Status', getAdminStatus));

  // Test 3: Get Pending Properties
  results.push(await test('Get Pending Properties', getPendingProperties));

  // Test 4: Admin Logout
  results.push(await test('Admin Logout', adminLogout));

  // Test 5: Verify Session is Cleared
  results.push(await test('Verify Session Cleared', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/me/admin`, {
      method: 'GET',
      headers: {
        'Cookie': cookies
      }
    });

    if (response.ok) {
      throw new Error('Session should be cleared but is still valid');
    }
    console.log(`  ✅ Session cleared correctly`);
  }));

  // Summary
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} passed\n`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Admin panel is fully functional.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review the output above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Test suite error:', error);
  process.exit(1);
});
