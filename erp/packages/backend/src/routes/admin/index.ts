import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AdminService } from '../../services/AdminService.js';
import { requireAdmin } from '../../middleware/authenticate.js';

export default async function adminRoutes(fastify: FastifyInstance) {
  const getService = (req: FastifyRequest) =>
    new AdminService(req.server.prisma, req.server.redis);

  // All admin routes require SYSTEM_ADMIN
  fastify.addHook('onRequest', requireAdmin);

  // ── Module Configuration ────────────────────────────────────────────────

  // GET /api/v1/admin/config/modules
  fastify.get('/config/modules', {
    schema: {
      tags: ['Admin'],
      summary: 'List all modules with enabled/disabled status',
      security: [{ bearerAuth: [] }],
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const svc = getService(req);
    const result = await svc.getModuleConfig(req.user.companyId);
    return reply.send(result);
  });

  // PUT /api/v1/admin/config/modules
  fastify.put('/config/modules', {
    schema: {
      tags: ['Admin'],
      summary: 'Enable or disable modules',
      body: {
        type: 'object',
        required: ['updates'],
        properties: {
          updates: {
            type: 'array',
            items: {
              type: 'object',
              required: ['module', 'enabled'],
              properties: {
                module: { type: 'string' },
                enabled: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (req: FastifyRequest<{ Body: { updates: Array<{ module: string; enabled: boolean }> } }>, reply: FastifyReply) => {
    const svc = getService(req);
    const result = await svc.updateModuleConfig(req.user.companyId, req.body.updates as any);
    return reply.send(result);
  });

  // ── Document Sequences ──────────────────────────────────────────────────

  // GET /api/v1/admin/config/sequences
  fastify.get('/config/sequences', {
    schema: {
      tags: ['Admin'],
      summary: 'List document sequences',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const svc = getService(req);
    const result = await svc.getSequences(req.user.companyId);
    return reply.send(result);
  });

  // PUT /api/v1/admin/config/sequences/:id
  fastify.put('/config/sequences/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Update document sequence settings',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          prefix: { type: 'string' },
          nextNo: { type: 'integer', minimum: 1 },
          padLength: { type: 'integer', minimum: 1, maximum: 10 },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: { prefix?: string; nextNo?: number; padLength?: number } }>, reply: FastifyReply) => {
    const svc = getService(req);
    const result = await svc.updateSequence(req.params.id, req.user.companyId, req.body);
    return reply.send(result);
  });

  // ── User Management ─────────────────────────────────────────────────────

  // GET /api/v1/admin/users
  fastify.get('/users', {
    schema: {
      tags: ['Admin'],
      summary: 'List users',
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 50 },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Querystring: { search?: string; page?: number; limit?: number; isActive?: boolean } }>, reply: FastifyReply) => {
    const svc = getService(req);
    const result = await svc.getUsers(req.user.companyId, req.query);
    return reply.send(result);
  });

  // POST /api/v1/admin/users
  fastify.post('/users', {
    schema: {
      tags: ['Admin'],
      summary: 'Create a new user',
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'roleId'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
          roleId: { type: 'string' },
          locationId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Body: { email: string; password: string; firstName: string; lastName: string; roleId: string; locationId?: string } }>, reply: FastifyReply) => {
    const svc = getService(req);
    const result = await svc.createUser(req.user.companyId, req.body);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/admin/users/:id
  fastify.put('/users/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Update user',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          roleId: { type: 'string' },
          locationId: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const svc = getService(req);
    const result = await svc.updateUser(req.params.id, req.user.companyId, req.body);
    return reply.send(result);
  });

  // ── Role Management ─────────────────────────────────────────────────────

  // GET /api/v1/admin/roles
  fastify.get('/roles', {
    schema: {
      tags: ['Admin'],
      summary: 'List roles with permissions',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const svc = getService(req);
    const result = await svc.getRoles(req.user.companyId);
    return reply.send(result);
  });

  // POST /api/v1/admin/roles
  fastify.post('/roles', {
    schema: {
      tags: ['Admin'],
      summary: 'Create a custom role',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Body: { name: string; description?: string } }>, reply: FastifyReply) => {
    const svc = getService(req);
    const result = await svc.createRole(req.user.companyId, req.body);
    return reply.code(201).send(result);
  });

  // PUT /api/v1/admin/roles/:id/permissions
  fastify.put('/roles/:id/permissions', {
    schema: {
      tags: ['Admin'],
      summary: 'Update role permissions (replaces all existing permissions)',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['permissions'],
        properties: {
          permissions: {
            type: 'array',
            items: {
              type: 'object',
              required: ['module', 'resource', 'action'],
              properties: {
                module: { type: 'string' },
                resource: { type: 'string' },
                action: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: { permissions: any[] } }>, reply: FastifyReply) => {
    const svc = getService(req);
    const result = await svc.updateRolePermissions(
      req.params.id,
      req.user.companyId,
      req.body.permissions
    );
    return reply.send(result);
  });
}
