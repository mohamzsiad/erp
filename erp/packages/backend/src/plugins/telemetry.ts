/**
 * Telemetry & Observability plugin.
 *
 * - Structured JSON logging via Pino (built into Fastify)
 * - Azure Application Insights SDK integration (when APPLICATIONINSIGHTS_CONNECTION_STRING is set)
 * - Request lifecycle logging: { requestId, userId, companyId, method, url, statusCode, duration }
 * - Custom metrics: document creation rate, approval times, login failures
 * - Distributed tracing via App Insights (automatic correlation)
 */
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

// ── App Insights client (lazy-initialised) ────────────────────────────────────
let appInsights: any = null;
let aiClient: any    = null;

async function initAppInsights() {
  if (!config.APPLICATIONINSIGHTS_CONNECTION_STRING) return;
  try {
    const ai = await import('applicationinsights');
    ai.setup(config.APPLICATIONINSIGHTS_CONNECTION_STRING)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(false)      // We use Pino for console
      .setUseDiskRetryCaching(true)
      .setDistributedTracingMode(ai.DistributedTracingModes.AI_AND_W3C)
      .start();

    appInsights = ai;
    aiClient    = ai.defaultClient;
    aiClient.config.samplingPercentage = 100;
  } catch (err) {
    // App Insights is optional — log but don't crash
    console.warn('App Insights not available:', (err as Error).message);
  }
}

// ── Custom metrics helpers ────────────────────────────────────────────────────
export function trackDocumentCreated(docType: string, companyId: string) {
  aiClient?.trackEvent({
    name: 'document.created',
    properties: { docType, companyId },
    measurements: { count: 1 },
  });
}

export function trackApprovalTime(docType: string, daysPending: number, approved: boolean) {
  aiClient?.trackMetric({
    name: 'approval.time_days',
    value: daysPending,
    properties: { docType, outcome: approved ? 'approved' : 'rejected' },
  });
}

export function trackLoginFailure(email: string, reason: string) {
  aiClient?.trackEvent({
    name: 'auth.login_failure',
    properties: { email: email.substring(0, 3) + '***', reason }, // Mask email
    measurements: { count: 1 },
  });
}

export function trackCustomMetric(name: string, value: number, properties?: Record<string, string>) {
  aiClient?.trackMetric({ name, value, properties });
}

// ── Plugin ────────────────────────────────────────────────────────────────────
export default fp(async (fastify: FastifyInstance) => {
  // Initialise App Insights before hooks are registered
  await initAppInsights();

  // ── Request start timestamp ───────────────────────────────────────────────
  fastify.addHook('onRequest', async (req: FastifyRequest) => {
    (req as any)._startTime = Date.now();
  });

  // ── Response logging ──────────────────────────────────────────────────────
  fastify.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const duration = Date.now() - ((req as any)._startTime ?? Date.now());
    const user     = (req as any).user;

    const logPayload: Record<string, unknown> = {
      requestId: req.id,
      method:    req.method,
      url:       req.url,
      statusCode: reply.statusCode,
      duration,
    };

    if (user) {
      logPayload.userId    = user.userId;
      logPayload.companyId = user.companyId;
      logPayload.role      = user.role;
    }

    // Log at appropriate level
    if (reply.statusCode >= 500) {
      fastify.log.error(logPayload, 'Request error');
    } else if (reply.statusCode >= 400) {
      fastify.log.warn(logPayload, 'Request failed');
    } else if (duration > 2000) {
      fastify.log.warn({ ...logPayload, slowRequest: true }, 'Slow request');
    } else {
      fastify.log.info(logPayload, 'Request completed');
    }

    // Track to App Insights
    if (aiClient) {
      aiClient.trackRequest({
        name: `${req.method} ${req.routerPath ?? req.url}`,
        url: req.url,
        duration,
        resultCode: reply.statusCode,
        success: reply.statusCode < 400,
        properties: {
          requestId:  req.id,
          userId:     user?.userId ?? 'anonymous',
          companyId:  user?.companyId ?? '',
        },
      });

      // Track slow requests as custom metric
      if (duration > 2000) {
        aiClient.trackMetric({
          name: 'request.slow',
          value: duration,
          properties: { url: req.url, method: req.method },
        });
      }
    }
  });

  // ── Error tracking ────────────────────────────────────────────────────────
  fastify.addHook('onError', async (req: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const user = (req as any).user;

    fastify.log.error({
      requestId: req.id,
      userId:    user?.userId,
      companyId: user?.companyId,
      error: {
        name:    error.name,
        message: error.message,
        stack:   config.NODE_ENV === 'development' ? error.stack : undefined,
      },
    }, 'Unhandled error');

    aiClient?.trackException({
      exception: error,
      properties: {
        requestId:  req.id,
        url:        req.url,
        method:     req.method,
        userId:     user?.userId ?? 'anonymous',
        companyId:  user?.companyId ?? '',
      },
    });
  });

  fastify.log.info({
    appInsights: !!aiClient,
    buildSha:    config.BUILD_SHA ?? 'local',
    version:     config.BUILD_VERSION ?? 'dev',
  }, 'Telemetry plugin registered');
}, { name: 'telemetry', fastify: '4.x' });
