const Sentry = require('@sentry/node');
const logger = require('./logger');

/**
 * Initialize Sentry for error tracking
 */
const initSentry = (app) => {
  const sentryEnabled = process.env.SENTRY_ENABLED === 'true';
  const sentryDSN = process.env.SENTRY_DSN;

  if (!sentryEnabled || !sentryDSN) {
    logger.info('Sentry error tracking is disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDSN,
      environment: process.env.SENTRY_ENVIRONMENT || 'production',
      tracesSampleRate: 1.0,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({
          app: true,
          request: true,
          serverName: true,
          transaction: true,
          user: true,
          version: true
        })
      ]
    });

    // The request handler must be the first middleware on the app
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());

    logger.info('Sentry error tracking initialized successfully', {
      environment: process.env.SENTRY_ENVIRONMENT || 'production'
    });
  } catch (error) {
    logger.error(`Failed to initialize Sentry: ${error.message}`);
  }
};

/**
 * Sentry error handler middleware - must be after all other middleware
 */
const sentryErrorHandler = () => {
  const sentryEnabled = process.env.SENTRY_ENABLED === 'true';
  
  if (!sentryEnabled) {
    return (err, req, res, next) => {
      next(err);
    };
  }

  return Sentry.Handlers.errorHandler();
};

/**
 * Capture exception manually
 */
const captureException = (error, context = {}) => {
  if (process.env.SENTRY_ENABLED === 'true') {
    Sentry.captureException(error, {
      tags: context
    });
  }
  logger.error(error.message, context);
};

/**
 * Capture message
 */
const captureMessage = (message, level = 'info', context = {}) => {
  if (process.env.SENTRY_ENABLED === 'true') {
    Sentry.captureMessage(message, level);
  }
  logger[level](message, context);
};

module.exports = {
  initSentry,
  sentryErrorHandler,
  captureException,
  captureMessage,
  Sentry
};
