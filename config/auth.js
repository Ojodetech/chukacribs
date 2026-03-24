const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'test-secret');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const ADMIN_JWT_SECRET = process.env.ADMIN_SECRET_KEY || (process.env.NODE_ENV === 'production' ? undefined : 'test-secret');
const ADMIN_JWT_EXPIRY = process.env.ADMIN_JWT_EXPIRY || '4h';

// Enforce no hardcoded or empty secrets in production
if (process.env.NODE_ENV === 'production') {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production and cannot use default test secret');
  }
  if (!ADMIN_JWT_SECRET) {
    throw new Error('ADMIN_SECRET_KEY must be set in production and cannot use default test secret');
  }
}

// Warn in non-production if weak defaults are used so CI keeps secure behavior
if (process.env.NODE_ENV !== 'production') {
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ Using test JWT_SECRET. Set environment variable in your CI pipeline for secure tests.');
  }
  if (!process.env.ADMIN_SECRET_KEY) {
    console.warn('⚠️ Using test ADMIN_SECRET_KEY. Set environment variable in your CI pipeline for secure tests.');
  }
}

// The JWT secret used for signing tokens
const ACTIVE_JWT_SECRET = JWT_SECRET;
const ACTIVE_ADMIN_SECRET = ADMIN_JWT_SECRET;

// Generate JWT token for landlords
const generateToken = (landlordId, role = 'landlord') => {
  return jwt.sign({ id: landlordId, role }, ACTIVE_JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

// Generate JWT token for users (payment access)
const generateUserToken = (userEmail) => {
  return jwt.sign({ email: userEmail, role: 'user' }, ACTIVE_JWT_SECRET, { expiresIn: '24h' });
};

// Generate Admin JWT token
const generateAdminToken = (expiresIn = ADMIN_JWT_EXPIRY) => {
  return jwt.sign({ role: 'admin' }, ACTIVE_JWT_SECRET, { expiresIn });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Set HTTP-only cookie with JWT (secure, production-ready)
const setAuthCookie = (res, token, expiryMs = 7 * 24 * 60 * 60 * 1000) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('authToken', token, {
    httpOnly: true,           // Cannot be accessed via JavaScript (XSS protection)
    secure: isProduction,     // HTTPS only in production
    sameSite: 'strict',       // CSRF protection
    maxAge: expiryMs,         // Cookie expiration time in ms
    path: '/',
    domain: isProduction ? undefined : undefined  // Will use current domain
  });
};

// Set admin cookie
const setAdminCookie = (res, token, expiryMs = 4 * 60 * 60 * 1000) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('adminToken', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: expiryMs,
    path: '/',
  });
};

// Clear authentication cookies
const clearAuthCookies = (res) => {
  res.clearCookie('authToken', { path: '/' });
  res.clearCookie('adminToken', { path: '/' });
};

// Middleware to verify landlord/user from cookie OR Bearer token
const authenticateLandlord = async (req, res, next) => {
  try {
    // Try Bearer token first (from header)
    const bearerToken = req.headers.authorization?.split(' ')[1];
    const cookieToken = req.cookies?.authToken;
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized - No authentication token' });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'landlord') {
      return res.status(401).json({ message: 'Unauthorized - Invalid or expired token' });
    }

    req.landlordId = decoded.id;
    
    // Optionally fetch and attach landlord details
    try {
      const Landlord = require('../models/Landlord');
      const landlord = await Landlord.findById(decoded.id);
      if (landlord) {
        req.landlordEmail = landlord.email;
        req.landlordPhone = landlord.phone;
        req.landlordName = landlord.name;
      }
    } catch (err) {
      console.warn('Could not fetch landlord details:', err.message);
    }
    
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized - Invalid token', error: err.message });
  }
};
// Middleware to verify user access token
const authenticateUser = (req, res, next) => {
  const token = req.cookies?.authToken;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized - No access token' });
  }

  const decoded = verifyToken(token);
  if (!decoded || (decoded.role !== 'user' && decoded.role !== 'landlord' && decoded.role !== 'admin')) {
    return res.status(401).json({ message: 'Unauthorized - Invalid token' });
  }

  req.userEmail = decoded.email || decoded.id;
  req.userRole = decoded.role;
  
  next();
};

// Middleware to verify student from JWT token (from Bearer header)
const authenticateStudent = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.authToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized - No authentication token' });
    }

    const decoded = verifyToken(token);
    if (!decoded || (decoded.role !== 'student' && !decoded.userId)) {
      return res.status(401).json({ success: false, message: 'Unauthorized - Invalid or expired token' });
    }

    req.user = { id: decoded.userId || decoded.id };
    req.userId = decoded.userId || decoded.id;
    req.userRole = decoded.role || 'student';
    
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Unauthorized - Invalid token', error: err.message });
  }
};

// Middleware to verify admin from JWT token (from Bearer header or cookie)
const authenticateAdmin = async (req, res, next) => {
  try {
    const bearerToken = req.headers.authorization?.split(' ')[1];
    const cookieToken = req.cookies?.adminToken;
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No admin token' });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized - Invalid or expired admin token' });
    }

    req.user = { _id: decoded.id || 'admin', role: 'admin' };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
};

module.exports = {
  generateToken,
  generateUserToken,
  generateAdminToken,
  verifyToken,
  setAuthCookie,
  setAdminCookie,
  clearAuthCookies,
  authenticateLandlord,
  authenticateAdmin,
  authenticateUser,
  authenticateStudent,
  JWT_SECRET,
  JWT_EXPIRY,
  ADMIN_JWT_EXPIRY
};