#!/usr/bin/env node

/**
 * Production Readiness Check Script
 * Run this before deploying to production
 */

require('dotenv').config({ path: '.env.production' });

console.log('🔍 ChukaCribs Production Readiness Check\n');

// Check critical environment variables
const checks = [
  {
    name: 'NODE_ENV',
    value: process.env.NODE_ENV,
    required: true,
    expected: 'production'
  },
  {
    name: 'MONGODB_URI',
    value: process.env.MONGODB_URI,
    required: true,
    pattern: /^mongodb\+srv:\/\/.*@.*\.mongodb\.net/
  },
  {
    name: 'JWT_SECRET',
    value: process.env.JWT_SECRET,
    required: true,
    minLength: 32
  },
  {
    name: 'AFRICASTALKING_USERNAME',
    value: process.env.AFRICASTALKING_USERNAME,
    required: true
  },
  {
    name: 'AFRICASTALKING_API_KEY',
    value: process.env.AFRICASTALKING_API_KEY,
    required: true,
    pattern: /^atsk_/
  },
  {
    name: 'SMS_ENABLED',
    value: process.env.SMS_ENABLED,
    required: true,
    expected: 'true'
  },
  {
    name: 'MPESA_ENVIRONMENT',
    value: process.env.MPESA_ENVIRONMENT,
    required: true,
    expected: 'production'
  },
  {
    name: 'MPESA_CONSUMER_KEY',
    value: process.env.MPESA_CONSUMER_KEY,
    required: true
  },
  {
    name: 'FRONTEND_URL',
    value: process.env.FRONTEND_URL,
    required: true,
    pattern: /^https:\/\/.*[^\/]$/
  }
];

let allPassed = true;

checks.forEach(check => {
  const status = checkStatus(check);
  console.log(`${status.emoji} ${check.name}: ${status.message}`);
  if (!status.passed) allPassed = false;
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('✅ PRODUCTION READY: All checks passed!');
  console.log('🚀 You can safely deploy to production.');
} else {
  console.log('❌ NOT READY: Fix the issues above before deploying.');
  console.log('💡 Update your .env.production file with correct values.');
}

console.log('\n📋 Next Steps:');
console.log('1. Update Render environment variables');
console.log('2. Test SMS with real phone number');
console.log('3. Deploy to production');
console.log('4. Verify all endpoints work');

function checkStatus(check) {
  if (!check.value && check.required) {
    return { emoji: '❌', message: 'MISSING (required)', passed: false };
  }

  if (!check.value && !check.required) {
    return { emoji: '⚠️', message: 'MISSING (optional)', passed: true };
  }

  if (check.expected && check.value !== check.expected) {
    return { emoji: '❌', message: `${check.value} (expected: ${check.expected})`, passed: false };
  }

  if (check.minLength && check.value.length < check.minLength) {
    return { emoji: '❌', message: `TOO SHORT (min: ${check.minLength} chars)`, passed: false };
  }

  if (check.pattern && !check.pattern.test(check.value)) {
    return { emoji: '❌', message: `${check.value} (invalid format)`, passed: false };
  }

  return { emoji: '✅', message: check.value, passed: true };
}