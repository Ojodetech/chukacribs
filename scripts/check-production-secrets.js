const required = ['JWT_SECRET', 'ADMIN_SECRET_KEY'];
const missing = required.filter((k) => !process.env[k] || process.env[k] === '');

if (process.env.NODE_ENV === 'production') {
  if (missing.length > 0) {
    console.error(`❌ Missing required production secrets: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (process.env.JWT_SECRET === 'test-secret') {
    console.error(`❌ Invalid JWT_SECRET in production: test-secret is not allowed`);
    process.exit(1);
  }

  if (process.env.ADMIN_SECRET_KEY === 'test-secret') {
    console.error(`❌ Invalid ADMIN_SECRET_KEY in production: test-secret is not allowed`);
    process.exit(1);
  }

  console.log('✅ Production secrets validation passed.');
} else {
  console.log('ℹ️ Not in production mode. Secrets validation skipped.');
}
