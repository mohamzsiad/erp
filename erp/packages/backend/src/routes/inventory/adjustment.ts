import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AdjustmentService } from '../../services/inventory/AdjustmentService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:    requirePermission('INVENTORY', 'STOCK_ADJUSTMENT', 'VIEW'),
  CREATE:  requirePermission('INVENTORY', 'STOCK_ADJUSTMENT', 'CREATE'),
  SUBMIT:  requirePermission('INVENTORY', 'STOCK_ADJUSTMENT', 'EDIT'),
  APPROVE: requirePermission('INVENTORY', 'STOCK_ADJUSTMENT', 'APPROVE'),
};

const adjLineSchema = {
  type: 'object',
  required: ['itemId', 'uomId', 'systemQty', 'physicalQty', 'lineNo'],
  properties: {
    itemId:      { type: 'string' },
    uomId:       { type: 'string' },
    binId:       { type: 'string' },
    systemQty:   { type: 'number', minimum: 0 },
    physicalQty: { type: 'number', minimum: 0 },
    lineNo:      { type: 'integer', minimum: 1 },
  },
};

export default async function adjustmentRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new AdjustmentService(req.server.prisma);

  // GET /adjustment
  fastify.get('/', {
    schema: {
      tags: ['Inventory - Adjustment'],
      querystring: {
        type: 'object',
        properties: {
          status:      { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED'] },
          warehouseId: { type: 'string' },
          dateFrom:    { type: 'string', format: 'date' },
          dateTo:      { type: 'string', format: 'date' },
          search:      { type: 'string' },
          page:        { type: 'integer', minimum: 1, default: 1 },
          limit:       { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).list({ companyId: req.user.companyId, ...req.query }));
  });

  // GET /adjustment/reasons
  fastify.get('/reasons', {
    schema: { tags: ['Inventory - Adjustment'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).listReasons(req.user.companyId));
  });

  // POST /adjustment/reasons
  fastify.post('/reasons', {
    schema: {
      tags: ['Inventory - Adjustment'],
      body: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(
      await svc(req).createReason(req.user.companyId, req.body.code, req.body.name),
    );
  });

  // GET /adjustment/:id
  fastify.get('/:id', {
    schema: {
      tags: ['Inventory - Adjustment'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  // POST /adjustment
  fastify.post('/', {
    schema: {
      tags: ['Inventory - Adjustment'],
      body: {
        type: 'object',
        required: ['warehouseId', 'reasonId', 'docDate', 'lines'],
        properties: {
          warehouseId: { type: 'string' },
          reasonId:    { type: 'string' },
          docDate:     { type: 'string', format: 'date' },
          lines:       { type: 'array', items: adjLineSchema, minItems: 1 },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(
      await svc(req).create(req.body, req.user.companyId, req.user.userId),
    );
  });

  // POST /adjustment/:id/submit
  fastify.post('/:id/submit', {
    schema: {
      tags: ['Inventory - Adjustment'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.SUBMIT],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).submit(req.params.id, req.user.companyId, req.user.userId));
  });

  // POST /adjustment/:id/approve
  fastify.post('/:id/approve', {
    schema: {
      tags: ['Inventory - Adjustment'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.APPROVE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).approve(req.params.id, req.user.companyId, req.user.userId));
  });

  // POST /adjustment/:id/reject
  fastify.post('/:id/reject', {
    schema: {
      tags: ['Inventory - Adjustment'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.APPROVE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).reject(req.params.id, req.user.companyId, req.user.userId));
  });
}
