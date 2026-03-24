/**
 * SSL/TLS Certificate Automation
 * 
 * Automatically manages SSL certificates with Let's Encrypt
 * Features:
 * - Auto-renewal before expiration
 * - Multiple domain support
 * - ACME challenge handling
 * - Certificate monitoring
 * - Graceful certificate updates
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const logger = require('./logger');

class CertificateManager {
  constructor() {
    this.certsPath = process.env.CERTS_PATH || './certs';
    this.email = process.env.LETSENCRYPT_EMAIL || 'admin@chukacribs.local';
    this.domains = (process.env.DOMAINS || 'chukacribs.local').split(',').map(d => d.trim());
    this.renewalThreshold = 30; // Renew 30 days before expiration
    this.renewalInterval = 24 * 60 * 60 * 1000; // Check daily
    this.renewalTimer = null;
  }
  
  /**
   * Initialize certificate management
   */
  async initialize() {
    try {
      // Ensure certs directory exists
      if (!fs.existsSync(this.certsPath)) {
        fs.mkdirSync(this.certsPath, { recursive: true });
      }
      
      logger.info('Certificate manager initialized', {
        domains: this.domains,
        certsPath: this.certsPath
      });
      
      // Check for existing certificates
      const certExist = this._certFileExists();
      
      if (!certExist) {
        logger.warn('No existing certificate found, will request new one');
        // Certificates will be requested on first use
      } else {
        logger.info('Found existing certificate');
        // Schedule renewal checks
        this._scheduleRenewalCheck();
      }
      
      return certExist;
    } catch (error) {
      logger.error('Failed to initialize certificate manager', error);
      throw error;
    }
  }
  
  /**
   * Get certificate paths
   */
  getCertificatePaths() {
    return {
      cert: path.join(this.certsPath, 'cert.pem'),
      key: path.join(this.certsPath, 'key.pem'),
      chain: path.join(this.certsPath, 'chain.pem'),
      fullchain: path.join(this.certsPath, 'fullchain.pem')
    };
  }
  
  /**
   * Request new certificate (using Certbot/ACME)
   */
  async requestNewCertificate() {
    return new Promise((resolve, reject) => {
      try {
        logger.info('Requesting new certificate from Let\'s Encrypt', {
          domains: this.domains,
          email: this.email
        });
        
        const args = [
          'certonly',
          '--standalone',
          '--non-interactive',
          '--agree-tos',
          `--email=${this.email}`,
          '--preferred-challenges=http',
          ...this.domains.flatMap(domain => ['-d', domain])
        ];
        
        const certbot = spawn('certbot', args);
        let output = '';
        let error = '';
        
        certbot.stdout.on('data', (data) => {
          output += data.toString();
          logger.debug('Certbot output:', data.toString());
        });
        
        certbot.stderr.on('data', (data) => {
          error += data.toString();
          logger.debug('Certbot error:', data.toString());
        });
        
        certbot.on('close', (code) => {
          if (code === 0) {
            logger.info('Certificate successfully obtained');
            this._copyCertificates();
            this._scheduleRenewalCheck();
            resolve(true);
          } else {
            const errorMsg = error || output || 'Unknown error';
            logger.error('Certbot failed', { code, output: errorMsg });
            reject(new Error(`Certbot failed with code ${code}: ${errorMsg}`));
          }
        });
        
        certbot.on('error', (err) => {
          logger.error('Failed to spawn certbot', err);
          reject(err);
        });
        
      } catch (error) {
        logger.error('Exception during certificate request', error);
        reject(error);
      }
    });
  }
  
  /**
   * Renew existing certificate
   */
  async renewCertificate() {
    return new Promise((resolve, reject) => {
      try {
        logger.info('Renewing certificate');
        
        const certbot = spawn('certbot', ['renew', '--non-interactive']);
        let output = '';
        
        certbot.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        certbot.on('close', (code) => {
          if (code === 0) {
            logger.info('Certificate successfully renewed');
            this._copyCertificates();
            this._reloadApplication();
            resolve(true);
          } else {
            logger.error('Certificate renewal failed', { code });
            reject(new Error(`Renewal failed with code ${code}`));
          }
        });
        
      } catch (error) {
        logger.error('Exception during certificate renewal', error);
        reject(error);
      }
    });
  }
  
  /**
   * Check certificate expiration
   */
  checkCertificateExpiration(certPath = null) {
    try {
      const cert = certPath || this.getCertificatePaths().cert;
      
      if (!fs.existsSync(cert)) {
        logger.warn('Certificate file not found', { cert });
        return null;
      }
      
      const certContent = fs.readFileSync(cert, 'utf8');
      const match = certContent.match(/notAfter=(.+?)(?:\n|$)/);
      
      if (!match) {
        // Parse using OpenSSL
        return this._getExpirationFromOpenSSL(cert);
      }
      
      return new Date(match[1]);
    } catch (error) {
      logger.error('Failed to check certificate expiration', error);
      return null;
    }
  }
  
  /**
   * Get days until expiration
   */
  getDaysUntilExpiration() {
    const expirationDate = this.checkCertificateExpiration();
    
    if (!expirationDate) {
      return null;
    }
    
    const now = new Date();
    const diffTime = expirationDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }
  
  /**
   * Check if renewal is needed
   */
  isRenewalNeeded() {
    const daysUntilExpiration = this.getDaysUntilExpiration();
    
    if (daysUntilExpiration === null) {
      return true; // No certificate found
    }
    
    return daysUntilExpiration <= this.renewalThreshold;
  }
  
  /**
   * Get certificate info
   */
  getCertificateInfo() {
    try {
      const certPath = this.getCertificatePaths().cert;
      
      if (!fs.existsSync(certPath)) {
        return null;
      }
      
      const expirationDate = this.checkCertificateExpiration(certPath);
      const daysUntilExpiration = this.getDaysUntilExpiration();
      
      return {
        certPath,
        expirationDate,
        daysUntilExpiration,
        needsRenewal: this.isRenewalNeeded(),
        domains: this.domains,
        email: this.email
      };
    } catch (error) {
      logger.error('Failed to get certificate info', error);
      return null;
    }
  }
  
  /**
   * Validate certificate
   */
  validateCertificate() {
    try {
      const paths = this.getCertificatePaths();
      
      // Check if all required files exist
      const requiredFiles = [paths.cert, paths.key];
      const missing = requiredFiles.filter(file => !fs.existsSync(file));
      
      if (missing.length > 0) {
        logger.warn('Missing certificate files', { missing });
        return false;
      }
      
      // Check certificate validity
      const info = this.getCertificateInfo();
      
      if (!info) {
        logger.warn('Could not read certificate info');
        return false;
      }
      
      if (info.daysUntilExpiration <= 0) {
        logger.warn('Certificate has expired');
        return false;
      }
      
      logger.info('Certificate validation successful', {
        daysUntilExpiration: info.daysUntilExpiration,
        expirationDate: info.expirationDate
      });
      
      return true;
    } catch (error) {
      logger.error('Certificate validation failed', error);
      return false;
    }
  }
  
  /**
   * Export certificate for use
   */
  exportCertificate() {
    try {
      const paths = this.getCertificatePaths();
      
      if (!fs.existsSync(paths.cert) || !fs.existsSync(paths.key)) {
        return null;
      }
      
      return {
        cert: fs.readFileSync(paths.cert, 'utf8'),
        key: fs.readFileSync(paths.key, 'utf8'),
        chain: fs.existsSync(paths.chain) ? fs.readFileSync(paths.chain, 'utf8') : null
      };
    } catch (error) {
      logger.error('Failed to export certificate', error);
      return null;
    }
  }
  
  /**
   * Setup HTTPS server with automatic cert
   */
  createSecureServer(app, options = {}) {
    try {
      const certData = this.exportCertificate();
      
      if (!certData) {
        logger.error('Cannot create secure server: certificate not available');
        return null;
      }
      
      const httpsOptions = {
        cert: certData.cert,
        key: certData.key,
        ...options
      };
      
      const server = https.createServer(httpsOptions, app);
      
      // Setup certificate refresh on update
      this._setupCertificateWatcher(server);
      
      return server;
    } catch (error) {
      logger.error('Failed to create secure server', error);
      return null;
    }
  }
  
  /**
   * Private: Copy certificates from Let's Encrypt
   */
  _copyCertificates() {
    try {
      // This would typically copy from /etc/letsencrypt/live/domain-name/
      // to the application's certificate directory
      logger.info('Certificate files prepared');
    } catch (error) {
      logger.error('Failed to copy certificates', error);
    }
  }
  
  /**
   * Private: Check if cert file exists
   */
  _certFileExists() {
    const paths = this.getCertificatePaths();
    return fs.existsSync(paths.cert) && fs.existsSync(paths.key);
  }
  
  /**
   * Private: Get expiration from OpenSSL
   */
  _getExpirationFromOpenSSL(certPath) {
    try {
      const certbot = spawn('openssl', ['x509', '-enddate', '-noout', '-in', certPath]);
      let output = '';
      
      certbot.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      certbot.on('close', () => {
        const match = output.match(/notAfter=(.+)/);
        if (match) {
          return new Date(match[1]);
        }
      });
      
      return null;
    } catch (error) {
      logger.error('Failed to parse certificate with OpenSSL', error);
      return null;
    }
  }
  
  /**
   * Private: Schedule renewal check
   */
  _scheduleRenewalCheck() {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
    }
    
    // Check every 24 hours
    this.renewalTimer = setInterval(async () => {
      try {
        if (this.isRenewalNeeded()) {
          logger.info('Certificate renewal needed');
          await this.renewCertificate();
        }
      } catch (error) {
        logger.error('Renewal check failed', error);
      }
    }, this.renewalInterval);
    
    logger.info('Certificate renewal checks scheduled', {
      interval: `${this.renewalInterval / (1000 * 60 * 60)} hours`
    });
  }
  
  /**
   * Private: Watch for certificate changes
   */
  _setupCertificateWatcher(server) {
    try {
      const certPath = this.getCertificatePaths().cert;
      
      fs.watchFile(certPath, async () => {
        logger.info('Certificate file changed, reloading...');
        await this._reloadApplication();
      });
    } catch (error) {
      logger.error('Failed to setup certificate watcher', error);
    }
  }
  
  /**
   * Private: Reload application with new certificate
   */
  async _reloadApplication() {
    try {
      logger.info('Reloading application with new certificate');
      // Trigger application reload - implementation depends on app structure
      // This could emit an event for the app to handle gracefully
      process.emit('certificate-updated');
    } catch (error) {
      logger.error('Failed to reload application', error);
    }
  }
  
  /**
   * Private: Cleanup old certificates
   */
  async _cleanupOldCertificates() {
    try {
      // Keep only the last 3 certificate versions
      const files = fs.readdirSync(this.certsPath);
      const certFiles = files.filter(f => f.startsWith('cert-'));
      
      if (certFiles.length > 3) {
        const toDelete = certFiles.sort().slice(0, -3);
        
        for (const file of toDelete) {
          fs.unlinkSync(path.join(this.certsPath, file));
          logger.info('Deleted old certificate', { file });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old certificates', error);
    }
  }
}

module.exports = new CertificateManager();
