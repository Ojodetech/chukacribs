const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = {
  info: (message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message} ${JSON.stringify(data)}\n`;
    console.log(logMessage);
    fs.appendFile(path.join(logsDir, 'app.log'), logMessage, (err) => {
      if (err) {console.error('Logger write failed:', err);}
    });
  },

  error: (message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message} ${JSON.stringify(data)}\n`;
    console.error(logMessage);
    fs.appendFile(path.join(logsDir, 'error.log'), logMessage, (err) => {
      if (err) {console.error('Logger write failed:', err);}
    });
  },

  warn: (message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message} ${JSON.stringify(data)}\n`;
    console.warn(logMessage);
    fs.appendFile(path.join(logsDir, 'app.log'), logMessage, (err) => {
      if (err) {console.error('Logger write failed:', err);}
    });
  },

  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] DEBUG: ${message} ${JSON.stringify(data)}\n`;
      console.debug(logMessage);
    }
  }
};

module.exports = logger;
