#!/usr/bin/env node

/**
 * Generate self-signed SSL certificates for development
 * This script creates cert.pem and key.pem for HTTPS testing on localhost
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const sslDir = path.join(__dirname, '../ssl');
  const certPath = path.join(sslDir, 'cert.pem');
  const keyPath = path.join(sslDir, 'key.pem');
  
  // Create ssl directory if it doesn't exist
  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
    console.log('✅ Created ssl directory');
  }
  
  // Check if certificates already exist
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log('✅ SSL certificates already exist at:');
    console.log(`   - ${certPath}`);
    console.log(`   - ${keyPath}`);
    process.exit(0);
  }
  
  // Try using Node.js crypto module
  const crypto = require('crypto');
  const { promisify } = require('util');
  const pem = require('pem');
  
  // Create a self-signed certificate
  pem.createCertificate({
    days: 365,
    selfSigned: true,
    commonName: 'localhost'
  }, (err, result) => {
    if (err) {
      console.error('❌ Error generating certificates:', err.message);
      // Fallback: create a dummy certificate
      createFallbackCerts(certPath, keyPath);
      return;
    }
    
    fs.writeFileSync(certPath, result.certificate, 'utf8');
    fs.writeFileSync(keyPath, result.clientKey, 'utf8');
    
    console.log(`✅ Certificate written to: ${certPath}`);
    console.log(`✅ Private key written to: ${keyPath}`);
    console.log('\n📝 Self-signed SSL certificates generated successfully!');
    console.log('⚠️  Note: Browsers will show a security warning for localhost');
    console.log('✅ This is normal for development - click "Advanced" and continue');
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('\n📝 Installing required packages...');
  process.exit(1);
}

function createFallbackCerts(certPath, keyPath) {
  // This is a fallback - you need to install pem module
  console.error('❌ pem module required. Install with: npm install pem');
  process.exit(1);
}
