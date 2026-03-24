const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * HTTPS/SSL Configuration
 */
const getSSLOptions = () => {
  const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
  
  if (!httpsEnabled) {
    logger.info('HTTPS is disabled. Using HTTP only.');
    return null;
  }

  try {
    const certPath = process.env.SSL_CERT_PATH || './ssl/cert.pem';
    const keyPath = process.env.SSL_KEY_PATH || './ssl/key.pem';

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      logger.warn(`SSL certificates not found at ${certPath} and ${keyPath}. Using HTTP.`);
      return null;
    }

    const options = {
      cert: fs.readFileSync(certPath, 'utf8'),
      key: fs.readFileSync(keyPath, 'utf8')
    };

    logger.info('HTTPS enabled with SSL certificates');
    return options;
  } catch (error) {
    logger.error(`Failed to load SSL certificates: ${error.message}`);
    return null;
  }
};

/**
 * Middleware to enforce HTTPS in production
 */
const enforceHttps = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${  req.get('host')  }${req.url}`);
  }
  next();
};

/**
 * Middleware to set secure cookie options
 */
const secureCoookie = (req, res, next) => {
  // Set secure cookie defaults
  res.cookie = function(name, val, options) {
    options = options || {};
    
    if (process.env.NODE_ENV === 'production') {
      options.secure = true;    // HTTPS only
      options.httpOnly = true;  // No JavaScript access
      options.sameSite = 'strict'; // CSRF protection
    }
    
    return res.cookie(name, val, options);
  };
  
  next();
};

module.exports = {
  getSSLOptions,
  enforceHttps,
  secureCoookie
};
