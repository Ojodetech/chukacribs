/**
 * Tracing Middleware
 * Auto-instruments HTTP requests with distributed tracing
 */

const { tracer } = require('../config/tracer');

/**
 * Create tracing middleware
 */
const tracingMiddleware = (req, res, next) => {
  // Get or create trace ID from headers
  const traceId = req.get('x-trace-id') || tracer.generateId();
  const parentSpanId = req.get('x-span-id') || null;

  // Start a span for this request
  const spanData = tracer.startTrace(`${req.method} ${req.path}`, traceId);
  const span = spanData.span;
  
  if (parentSpanId) {
    span.parentSpanId = parentSpanId;
  }

  // Attach to request for nested spans
  req.trace = {
    traceId: spanData.traceId,
    spanId: spanData.spanId,
    span,
    startSpan: (name) => tracer.startSpan(name, spanData)
  };

  // Set response headers for downstream services
  res.setHeader('x-trace-id', spanData.traceId);
  res.setHeader('x-span-id', spanData.spanId);

  // Capture response info
  const originalSend = res.send;
  res.send = function(data) {
    span.setTag('http.status_code', res.statusCode);
    span.setTag('http.method', req.method);
    span.setTag('http.url', req.originalUrl);
    span.setTag('http.target', req.path);
    span.setTag('http.host', req.get('host'));

    // Add error tag if status is 5xx
    if (res.statusCode >= 500) {
      span.setTag('error', true);
      span.setTag('error.kind', 'ServerError');
    } else if (res.statusCode >= 400 && res.statusCode < 500) {
      span.setTag('error', true);
      span.setTag('error.kind', 'ClientError');
    }

    // Finish span
    tracer.finishSpan(span);

    // Call original send
    return originalSend.call(this, data);
  };

  next();
};

module.exports = tracingMiddleware;
