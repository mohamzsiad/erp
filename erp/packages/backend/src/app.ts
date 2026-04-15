import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';

import { config } from './config.js';
import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import swaggerPlugin from './plugins/swagger.js';
import securityPlugin from './plugins/security.js';
import telemetryPlugin from './plugins/telemetry.js';
import authRoutes from './routes/auth/index.js';
import adminRoutes from './routes/admin/index.js';
import procurementRoutes from './routes/procurement/index.js';
import inventoryRoutes from './routes/inventory/index.js';
import notificationRoutes from './routes/notifications/index.js';
import coreRoutes from './routes/core/index.js';
import workflowRoutes from './routes/workflow/index.js';
import financeRoutes from './routes/finance/index.js';
import dashboardRoutes from './routes/dashboard/index.js';
import { authenticateRequest } from './middleware/authenticate.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }),
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            hostname: req.hostname,
            requestId: req.id,
          };
        },
      },
    },
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  // ── Rate Limiting (global baseline — security plugin adds per-route limits) ─
  await fastify.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_PUBLIC,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
  });

  // ── Core Plugins ───────────────────────────────────────────────────────────
  await fastify.register(sensible);
  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(websocket);

  // ── Security & Telemetry ───────────────────────────────────────────────────
  await fastify.register(telemetryPlugin);
  await fastify.register(securityPlugin);

  // ── Swagger (development only) ─────────────────────────────────────────────
  if (config.NODE_ENV !== 'production') {
    await fastify.register(swaggerPlugin);
  }

  // ── Health Check ───────────────────────────────────────────────────────────
  fastify.get('/api/v1/health', {
    schema: {
      tags: ['Health'],
      summary: 'Health check endpoint',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                db: { type: 'string' },
                redis: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    let dbStatus = 'ok';
    let redisStatus = 'ok';

    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'down';
    }

    try {
      await fastify.redis.ping();
    } catch {
      redisStatus = 'down';
    }

    const isHealthy = dbStatus === 'ok' && redisStatus === 'ok';
    return reply.code(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { db: dbStatus, redis: redisStatus },
    });
  });

  // ── Auth Routes (public — no JWT required) ────────────────────────────────
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });

  // ── Protected Routes ───────────────────────────────────────────────────────
  await fastify.register(async (protectedApp) => {
    // Apply JWT authentication to all routes in this scope
    protectedApp.addHook('onRequest', authenticateRequest);

    // Admin routes
    await protectedApp.register(adminRoutes, { prefix: '/api/v1/admin' });

    // Procurement routes
    await protectedApp.register(procurementRoutes, { prefix: '/api/v1/procurement' });

    // Inventory routes
    await protectedApp.register(inventoryRoutes, { prefix: '/api/v1/inventory' });

    // Notification routes
    await protectedApp.register(notificationRoutes, { prefix: '/api/v1/notifications' });

    // Core routes (locations, etc.)
    await protectedApp.register(coreRoutes, { prefix: '/api/v1/core' });

    // Workflow routes
    await protectedApp.register(workflowRoutes, { prefix: '/api/v1/workflow' });

    // Finance routes
    await protectedApp.register(financeRoutes, { prefix: '/api/v1/finance' });

    // Dashboard routes
    await protectedApp.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  });

  // ── Global Error Handler ───────────────────────────────────────────────────
  fastify.setErrorHandler((error, req, reply) => {
    fastify.log.error({ err: error, requestId: req.id }, 'Unhandled error');

    if (error.validation) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Request validation failed',
        details: error.validation,
      });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.code(statusCode).send({
      statusCode,
      error: error.name ?? 'Internal Server Error',
      message: statusCode === 500
        ? 'An unexpected error occurred'
        : error.message,
    });
  });

  return fastify;
}
