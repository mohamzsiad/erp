import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CostCenterService } from '../../services/finance/CostCenterService.js';
import { CostCodeService } from '../../services/finance/CostCodeService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('FINANCE', 'COST_CENTER', 'VIEW'),
  CREATE: requirePermission('FINANCE', 'COST_CENTER', 'CREATE'),
  EDIT:   requirePermission('FINANCE', 'COST_CENTER', 'EDIT'),
  DELETE: requirePermission('FINANCE', 'COST_CENTER', 'DELETE'),
};

export default async function costCenterRoutes(fastify: FastifyInstance) {
  const svc     = (req: FastifyRequest) => new CostCenterService(req.server.prisma);
  const codeSvc = (req: FastifyRequest) => new CostCodeService(req.server.prisma);

  // ── Cost Centers ──────────────────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      tags: ['Finance - Cost Centers'],
      querystring: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean' },
          search:   { type: 'string' },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).list(req.user.companyId, req.query));
  });

  fastify.get('/tree', { schema: { tags: ['Finance - Cost Centers'] }, preHandler: [PERM.VIEW] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      return reply.send(await svc(req).tree(req.user.companyId));
    }
  );

  fastify.get('/search', {
    schema: { tags: ['Finance - Cost Centers'], querystring: { type: 'object', properties: { q: { type: 'string' } } } },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: { q?: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).search(req.user.companyId, req.query.q ?? ''));
  });

  fastify.get('/:id', {
    schema: { tags: ['Finance - Cost Centers'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  fastify.get('/:id/budget-status', {
    schema: { tags: ['Finance - Cost Centers'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getBudgetStatus(req.params.id, req.user.companyId));
  });

  fastify.post('/', {
    schema: {
      tags: ['Finance - Cost Centers'],
      body: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code:            { type: 'string' },
          name:            { type: 'string' },
          parentId:        { type: 'string' },
          budgetHolderId:  { type: 'string' },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(await svc(req).create(req.user.companyId, req.body));
  });

  fastify.put('/:id', {
    schema: {
      tags: ['Finance - Cost Centers'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          name:           { type: 'string' },
          parentId:       { type: 'string' },
          budgetHolderId: { type: 'string' },
          isActive:       { type: 'boolean' },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).update(req.params.id, req.user.companyId, req.body));
  });

  fastify.delete('/:id', {
    schema: { tags: ['Finance - Cost Centers'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.DELETE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await svc(req).delete(req.params.id, req.user.companyId);
    return reply.code(204).send();
  });

  // ── Cost Codes (sub-resource) ──────────────────────────────────────────────
  fastify.get('/codes', {
    schema: {
      tags: ['Finance - Cost Codes'],
      querystring: {
        type: 'object',
        properties: {
          isActive:    { type: 'boolean' },
          search:      { type: 'string' },
          costCenterId: { type: 'string' },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await codeSvc(req).list(req.user.companyId, req.query));
  });

  fastify.get('/codes/search', {
    schema: { tags: ['Finance - Cost Codes'], querystring: { type: 'object', properties: { q: { type: 'string' } } } },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: { q?: string } }>, reply: FastifyReply) => {
    return reply.send(await codeSvc(req).search(req.user.companyId, req.query.q ?? ''));
  });

  fastify.post('/codes', {
    schema: {
      tags: ['Finance - Cost Codes'],
      body: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code:         { type: 'string' },
          name:         { type: 'string' },
          costCenterId: { type: 'string' },
          type:         { type: 'string', enum: ['COST_CENTER', 'PROJECT', 'DEPARTMENT'] },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(await codeSvc(req).create(req.user.companyId, req.body));
  });

  fastify.put('/codes/:id', {
    schema: {
      tags: ['Finance - Cost Codes'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          name:         { type: 'string' },
          costCenterId: { type: 'string' },
          isActive:     { type: 'boolean' },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    return reply.send(await codeSvc(req).update(req.params.id, req.user.companyId, req.body));
  });

  fastify.delete('/codes/:id', {
    schema: { tags: ['Finance - Cost Codes'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.DELETE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await codeSvc(req).delete(req.params.id, req.user.companyId);
    return reply.code(204).send();
  });
}
