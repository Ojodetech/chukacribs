// Test script to verify property upload via API
const http = require('http');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test configuration
const API_URL = 'http://localhost:3000';
const LANDLORD_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsYW5kbG9yZElkIjoiNjc4YzUyYjhkZWY5NzcwMDBmMmQ3YzlmIiwicm9sZSI6ImxhbmRsb3JkIiwiaWF0IjoxNzM3NTg2MjMwfQ.GdLqzVmlTKR7Zt8C-qVm0PYdJ1cXM-05p6OdNO-fLPU'; // From landlord login

console.log('🏠 Property Upload API Test');
console.log('=' .repeat(50));

// Test 1: Simple JSON upload (no files)
async function testSimpleUpload() {
  console.log('\n📝 Test 1: Simple FormData Upload (No Files)');
  console.log('-'.repeat(50));

  const formData = new FormData();
  formData.append('title', 'Test Property - Simple');
  formData.append('location', 'Chuka Town');
  formData.append('price', '15000');
  formData.append('type', 'Apartment');
  formData.append('bedrooms', '2');
  formData.append('description', 'A test property for uploading');
  formData.append('wifi', 'true');
  formData.append('water', 'true');
  formData.append('electricity', 'true');

  try {
    const response = await fetch(`${API_URL}/api/landlord-properties`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LANDLORD_TOKEN}`,
        'Cookie': `authToken=${LANDLORD_TOKEN}`
      },
      body: formData,
      credentials: 'include'
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ Test 1 PASSED');
      return true;
    } else {
      console.log('❌ Test 1 FAILED');
      return false;
    }
  } catch (error) {
    console.error('❌ Test 1 ERROR:', error.message);
    return false;
  }
}

// Run test
testSimpleUpload().then(success => {
  console.log(`\n${  '='.repeat(50)}`);
  if (success) {
    console.log('✅ All tests passed! Property upload is working.');
  } else {
    console.log('❌ Tests failed. Check the responses above for details.');
  }
  process.exit(success ? 0 : 1);
});
