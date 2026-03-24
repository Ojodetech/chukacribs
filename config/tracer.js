/**
 * Distributed Tracing System
 * 
 * Implements request tracing across services using span IDs and trace IDs.
 * Compatible with Jaeger, Zipkin, and other APM tools via standard formats.
 * 
 * Features:
 * - Unique trace ID generation per request
 * - Span creation for operations
 * - Parent-child span relationships
 * - Export to Jaeger/Zipkin
 * - Custom tags and logs for debugging
 * 
 * Usage:
 * const span = tracer.startSpan('operation-name');
 * span.setTag('user.id', userId);
 * // Do work
 * span.finish();
 */

const crypto = require('crypto');
const os = require('os');

/**
 * Span - Represents a single operation in a trace
 */
class Span {
  constructor(name, traceId, spanId, parentSpanId = null) {
    this.operationName = name;
    this.traceId = traceId;
    this.spanId = spanId;
    this.parentSpanId = parentSpanId;
    this.tags = {
      'span.kind': 'internal',
      'component': 'chuka-cribs',
      'service.name': 'chuka-cribs',
      'service.version': process.env.APP_VERSION || '1.0.0',
      'hostname': os.hostname()
    };
    this.logs = [];
    this.startTime = Date.now();
    this.duration = 0;
    this.finished = false;
  }

  /**
   * Set a tag on the span
   */
  setTag(key, value) {
    if (this.finished) {
      console.warn('Cannot set tag on finished span');
      return this;
    }
    this.tags[key] = value;
    return this;
  }

  /**
   * Log an event
   */
  log(message, fields = {}) {
    if (this.finished) {
      console.warn('Cannot log on finished span');
      return this;
    }
    this.logs.push({
      timestamp: Date.now(),
      message,
      fields
    });
    return this;
  }

  /**
   * Mark span as error
   */
  setError(error) {
    this.tags['error'] = true;
    this.tags['error.kind'] = error.name || 'Error';
    this.tags['error.message'] = error.message;
    this.tags['error.stack'] = error.stack;
    this.log('Error occurred', {
      message: error.message,
      stack: error.stack
    });
    return this;
  }

  /**
   * Finish the span
   */
  finish() {
    this.duration = Date.now() - this.startTime;
    this.finished = true;
    return this;
  }

  /**
   * Get span as JSON (for export to Jaeger)
   */
  toJSON() {
    return {
      traceID: this.traceId,
      spanID: this.spanId,
      parentSpanID: this.parentSpanId || undefined,
      operationName: this.operationName,
      tags: this.tags,
      logs: this.logs,
      startTime: this.startTime,
      duration: this.duration,
      references: this.parentSpanId ? [
        {
          refType: 'CHILD_OF',
          traceID: this.traceId,
          spanID: this.parentSpanId
        }
      ] : []
    };
  }
}

/**
 * Tracer - Creates and manages spans
 */
class Tracer {
  constructor(serviceName = 'chuka-cribs') {
    this.serviceName = serviceName;
    this.spans = [];
    this.maxSpans = 10000; // Keep last 10k spans
    this.jaegerEndpoint = process.env.JAEGER_ENDPOINT || null;
    this.jaegerEnabled = !!this.jaegerEndpoint;
  }

  /**
   * Generate unique IDs
   */
  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Start a new trace
   */
  startTrace(operationName, traceId = null) {
    const tid = traceId || this.generateId();
    const spanId = this.generateId();
    
    const span = new Span(operationName, tid, spanId);
    return {
      span,
      traceId: tid,
      spanId
    };
  }

  /**
   * Start a child span
   */
  startSpan(operationName, parentSpan) {
    const spanId = this.generateId();
    const span = new Span(
      operationName,
      parentSpan.traceId,
      spanId,
      parentSpan.spanId
    );
    return span;
  }

  /**
   * Finish and store span
   */
  finishSpan(span) {
    span.finish();
    this.spans.push(span);

    // Keep memory bounded
    if (this.spans.length > this.maxSpans) {
      this.spans.shift();
    }

    // Export to Jaeger if configured
    if (this.jaegerEnabled) {
      this.exportToJaeger(span);
    }

    return span;
  }

  /**
   * Export span to Jaeger
   */
  async exportToJaeger(span) {
    if (!this.jaegerEnabled) return;

    try {
      const payload = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: this.serviceName } }
              ]
            },
            instrumentationLibrarySpans: [
              {
                spans: [span.toJSON()]
              }
            ]
          }
        ]
      };

      // Send to Jaeger asynchronously (don't block)
      setImmediate(() => {
        this.sendToJaeger(payload).catch(err => {
          console.error('[Tracing] Jaeger export error:', err.message);
        });
      });
    } catch (err) {
      console.error('[Tracing] Export error:', err.message);
    }
  }

  /**
   * Send trace to Jaeger
   */
  async sendToJaeger(payload) {
    try {
      const response = await fetch(this.jaegerEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`[Tracing] Jaeger error: ${response.statusText}`);
      }
    } catch (err) {
      // Silently fail - don't let tracing break the app
      console.debug('[Tracing] Jaeger connection failed:', err.message);
    }
  }

  /**
   * Get recent spans
   */
  getRecentSpans(limit = 100) {
    return this.spans.slice(-limit).map(span => span.toJSON());
  }

  /**
   * Get spans by trace ID
   */
  getSpansByTraceId(traceId) {
    return this.spans
      .filter(span => span.traceId === traceId)
      .map(span => span.toJSON());
  }

  /**
   * Get spans by operation
   */
  getSpansByOperation(operationName) {
    return this.spans
      .filter(span => span.operationName === operationName)
      .map(span => span.toJSON());
  }

  /**
   * Get tracing statistics
   */
  getStats() {
    const slowSpans = this.spans
      .filter(s => s.duration > 1000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const errorSpans = this.spans
      .filter(s => s.tags.error === true)
      .slice(-10);

    return {
      totalSpans: this.spans.length,
      jaegerConnected: this.jaegerEnabled,
      jaegerEndpoint: this.jaegerEndpoint || 'Not configured',
      slowestSpans: slowSpans.map(s => ({
        operation: s.operationName,
        duration: s.duration,
        traceId: s.traceId,
        spanId: s.spanId
      })),
      recentErrors: errorSpans.map(s => ({
        operation: s.operationName,
        error: s.tags['error.message'],
        traceId: s.traceId,
        spanId: s.spanId
      }))
    };
  }

  /**
   * Search spans
   */
  searchSpans(query) {
    const { operation, minDuration, maxDuration, hasError } = query;

    return this.spans.filter(span => {
      if (operation && !span.operationName.includes(operation)) return false;
      if (minDuration && span.duration < minDuration) return false;
      if (maxDuration && span.duration > maxDuration) return false;
      if (hasError && !span.tags.error) return false;
      return true;
    }).map(span => span.toJSON());
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

const tracer = new Tracer('chuka-cribs');

// Initialize Jaeger if endpoint provided
if (process.env.JAEGER_ENDPOINT) {
  console.log('[Tracing] Jaeger enabled:', process.env.JAEGER_ENDPOINT);
}

module.exports = {
  tracer,
  Tracer,
  Span
};
