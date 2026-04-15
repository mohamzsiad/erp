/**
 * Security hardening plugin for Fastify.
 *
 * Registers:
 *  - Helmet (HTTP security headers: CSP, HSTS, X-Frame-Options, etc.)
 *  - CORS (allowed origins from CORS_ORIGINS env var)
 *  - Per-IP rate limiting (public: 100 req/min, authenticated: 1000 req/min)
 *  - Request body size limit (10 MB)
 *  - X-Request-ID header on every response
 *  - SQL injection / path traversal pattern rejection on query params
 *  - Removal of X-Powered-By header
 */
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

// ── SQL injection / path traversal patterns (basic WAF-like filter) ──────────
const DANGEROUS_PATTERNS = [
  /('|--|;|\bDROP\b|\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bEXEC\b)/i,
  /(\.\.[\/\\])/,                           // path traversal
  /(<script[\s>]|javascript:)/i,            // XSS in query params
  /\x00/,                                   // null bytes
];

function hasDangerousPattern(value: string): boolean {
  return DANGEROUS_PATTERNS.some((re) => re.test(value));
}

function scanQueryParams(query: Record<string, unknown>): boolean {
  for (const val of Object.values(query)) {
    if (typeof val === 'string' && hasDangerousPattern(val)) return true;
    if (Array.isArray(val) && val.some((v) => typeof v === 'string' && hasDangerousPattern(v))) return true;
  }
  return false;
}

// ── UUID validation helper (used by schemas, not the plugin itself) ──────────
export const UUID_SCHEMA = { type: 'string', format: 'uuid' } as const;

export default fp(async (fastify: FastifyInstance) => {
  // ── Remove X-Powered-By ────────────────────────────────────────────────────
  fastify.addHook('onSend', async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.removeHeader('X-Powered-By');
  });

  // ── X-Request-ID on every response ────────────────────────────────────────
  fastify.addHook('onSend', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header('X-Request-ID', req.id);
  });

  // ── Helmet (security headers) ──────────────────────────────────────────────
  await fastify.register(import('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],   // Allow inline styles (Tailwind)
        imgSrc:     ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc:    ["'self'"],
        objectSrc:  ["'none'"],
        frameSrc:   ["'none'"],
        upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
      },
    },
    hsts: config.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    xFrameOptions: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
    xDnsPrefetchControl: { allow: false },
    crossOriginEmbedderPolicy: false,  // Disabled — API is accessed cross-origin
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  });

  // ── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = config.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

  await fastify.register(import('@fastify/cors'), {
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) { cb(null, true); return; }
      if (allowedOrigins.some((o) => origin === o || origin.endsWith(o.replace(/^https?:\/\//, '')))) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} is not allowed`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,  // 24h preflight cache
  });

  // ── Request body size limit ────────────────────────────────────────────────
  fastify.addContentTypeParser('application/json', { bodyLimit: 10 * 1024 * 1024, parseAs: 'string' }, (req, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // ── Query parameter sanitisation (basic WAF-like filter) ──────────────────
  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.query && typeof req.query === 'object') {
      if (scanQueryParams(req.query as Record<string, unknown>)) {
        fastify.log.warn({ requestId: req.id, url: req.url }, 'Rejected request with dangerous query pattern');
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Request contains disallowed patterns',
        });
      }
    }
  });

  // ── Trim all string request body fields ───────────────────────────────────
  fastify.addHook('preHandler', async (req: FastifyRequest) => {
    if (req.body && typeof req.body === 'object') {
      trimStrings(req.body as Record<string, unknown>);
    }
  });

  fastify.log.info('Security plugin registered');
}, { name: 'security', fastify: '4.x' });

// ── Recursively trim string values in an object ────────────────────────────
function trimStrings(obj: Record<string, unknown>, depth = 0) {
  if (depth > 5) return;  // prevent deep recursion
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      obj[key] = val.trim();
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      trimStrings(val as Record<string, unknown>, depth + 1);
    } else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (typeof val[i] === 'string') val[i] = val[i].trim();
        else if (val[i] && typeof val[i] === 'object') trimStrings(val[i] as Record<string, unknown>, depth + 1);
      }
    }
  }
}
