import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../utils/jwt.js';
import { AuthService } from '../services/AuthService.js';
import type { JwtPayload, PermissionSet } from '@clouderp/shared';

// Extend FastifyRequest to carry auth context
declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
    permissions: PermissionSet[];
    enabledModules: string[];
  }
}

/**
 * Fastify onRequest hook — validates Bearer JWT and populates req.user,
 * req.permissions, and req.enabledModules on every protected request.
 */
export async function authenticateRequest(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header',
    });
  }

  const token = authHeader.slice(7);

  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(token);
  } catch (err: any) {
    const isExpired = err?.name === 'TokenExpiredError';
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: isExpired ? 'Access token expired' : 'Invalid access token',
    });
  }

  // Attach JWT payload to request
  req.user = payload;

  // Load permissions from cache/DB
  const authService = new AuthService(req.server.prisma, req.server.redis);
  req.permissions = await authService.loadPermissions(payload.userId, payload.roleId);

  // Load enabled modules for this company
  const company = await req.server.prisma.company.findUnique({
    where: { id: payload.companyId },
    select: { modulesEnabled: true },
  });
  req.enabledModules = (company?.modulesEnabled as string[]) ?? [];
}

/**
 * Helper factory — returns a Fastify onRequest hook that checks a specific permission.
 * Usage: fastify.addHook('onRequest', requirePermission('PROCUREMENT', 'PO', 'APPROVE'))
 */
export function requirePermission(module: string, resource: string, action: string) {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const has = req.permissions?.some(
      (p) => p.module === module && p.resource === resource && p.action === action
    );
    if (!has) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `You do not have permission to perform ${action} on ${resource}`,
      });
    }
  };
}

/**
 * Helper factory — returns a Fastify onRequest hook that checks module is enabled.
 * Usage: fastify.addHook('onRequest', requireModule('FINANCE'))
 */
export function requireModule(module: string) {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const enabled = req.enabledModules?.includes(module);
    if (!enabled) {
      return reply.code(402).send({
        statusCode: 402,
        error: 'Module Disabled',
        message: `The ${module} module is not enabled for this company`,
      });
    }
  };
}

/**
 * Inline helper — use inside route handlers for ad-hoc permission checks.
 */
export function checkPermission(
  req: FastifyRequest,
  module: string,
  resource: string,
  action: string
): boolean {
  return req.permissions?.some(
    (p) => p.module === module && p.resource === resource && p.action === action
  ) ?? false;
}

/**
 * Inline helper — check if a module is enabled.
 */
export function checkModuleEnabled(req: FastifyRequest, module: string): boolean {
  return req.enabledModules?.includes(module) ?? false;
}

/**
 * Shortcut: require SYSTEM_ADMIN role.
 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const isAdmin = req.permissions?.some(
    (p) => p.module === 'CORE' && p.resource === 'CONFIG' && p.action === 'CONFIGURE'
  );
  if (!isAdmin) {
    return reply.code(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'System Administrator access required',
    });
  }
}
