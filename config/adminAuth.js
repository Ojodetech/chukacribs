const rateLimit = require('express-rate-limit');
const { verifyToken } = require('./auth');

const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Too many admin attempts from this IP, please try again later.'
});

const adminAuth = (req, res, next) => {
  try {
    let token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;

    // Accept token in cookie as backup
    if (!token && req.cookies?.adminToken) {
      token = req.cookies.adminToken;
    }

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized - admin token required' });
    }

    // Verify JWT token first
    const decoded = verifyToken(token);
    if (decoded && decoded.role === 'admin') {
      req.adminId = decoded.id || decoded.userId || 'admin';
      return next();
    }

    // Fallback: legacy static secret key for admin operations
    const fallbackAdminSecret = (process.env.ADMIN_SECRET_KEY || '').trim();
    if (fallbackAdminSecret && token === fallbackAdminSecret) {
      req.adminId = 'admin-legacy';
      return next();
    }

    return res.status(403).json({ message: 'Forbidden - invalid admin credentials' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  adminAuth,
  adminRateLimiter
};