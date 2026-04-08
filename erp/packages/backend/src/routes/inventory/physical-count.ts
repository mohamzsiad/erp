import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PhysicalCountService } from '../../services/inventory/PhysicalCountService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:    requirePermission('INVENTORY', 'PHYSICAL_COUNT', 'VIEW'),
  CREATE:  requirePermission('INVENTORY', 'PHYSICAL_COUNT', 'CREATE'),
  EDIT:    requirePermission('INVENTORY', 'PHYSICAL_COUNT', 'EDIT'),
  APPROVE: requirePermission('INVENTORY', 'PHYSICAL_COUNT', 'APPROVE'),
};

export default async function physicalCountRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new PhysicalCountService(req.server.prisma);

  // GET /physical-count
  fastify.get('/', {
    schema: {
      tags: ['Inventory - Physical Count'],
      querystring: {
        type: 'object',
        properties: {
          status:      { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'POSTED', 'CANCELLED'] },
          warehouseId: { type: 'string' },
          page:        { type: 'integer', minimum: 1, default: 1 },
          limit:       { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).list({ companyId: req.user.companyId, ...req.query }));
  });

  // GET /physical-count/:id
  fastify.get('/:id', {
    schema: {
      tags: ['Inventory - Physical Count'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  // GET /physical-count/:id/variance
  fastify.get('/:id/variance', {
    schema: {
      tags: ['Inventory - Physical Count'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getVariance(req.params.id, req.user.companyId));
  });

  // POST /physical-count/initiate
  fastify.post('/initiate', {
    schema: {
      tags: ['Inventory - Physical Count'],
      body: {
        type: 'object',
        required: ['warehouseId', 'docDate'],
        properties: {
          warehouseId: { type: 'string' },
          docDate:     { type: 'string', format: 'date' },
          remarks:     { type: 'string' },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(
      await svc(req).initiate({
        ...req.body,
        companyId: req.user.companyId,
        userId:    req.user.userId,
      }),
    );
  });

  // PATCH /physical-count/:id/counts — batch enter physical counts
  fastify.patch('/:id/counts', {
    schema: {
      tags: ['Inventory - Physical Count'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['counts'],
        properties: {
          counts: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['lineId', 'physicalQty'],
              properties: {
                lineId:      { type: 'string' },
                physicalQty: { type: 'number', minimum: 0 },
              },
            },
          },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    return reply.send(
      await svc(req).enterCounts(req.params.id, req.user.companyId, req.body.counts),
    );
  });

  // POST /physical-count/:id/post
  fastify.post('/:id/post', {
    schema: {
      tags: ['Inventory - Physical Count'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.APPROVE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).post(req.params.id, req.user.companyId, req.user.userId));
  });

  // POST /physical-count/:id/cancel
  fastify.post('/:id/cancel', {
    schema: {
      tags: ['Inventory - Physical Count'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).cancel(req.params.id, req.user.companyId));
  });
}
