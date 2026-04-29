import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PoService } from '../../services/procurement/PoService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW: requirePermission('PROCUREMENT', 'PO', 'VIEW'),
  CREATE: requirePermission('PROCUREMENT', 'PO', 'CREATE'),
  EDIT: requirePermission('PROCUREMENT', 'PO', 'EDIT'),
  APPROVE: requirePermission('PROCUREMENT', 'PO', 'APPROVE'),
};

const lineSchema = {
  type: 'object',
  required: ['itemId', 'uomId', 'orderedQty', 'unitPrice', 'chargeCodeId'],
  properties: {
    itemId: { type: 'string' },
    uomId: { type: 'string' },
    chargeCodeId: { type: 'string' },
    orderedQty: { type: 'number', exclusiveMinimum: 0 },
    unitPrice: { type: 'number', minimum: 0 },
    discountPct: { type: 'number', minimum: 0, maximum: 100, default: 0 },
    taxPct: { type: 'number', minimum: 0, maximum: 100, default: 0 },
  },
};

export default async function poRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new PoService(req.server.prisma);

  // GET /po
  fastify.get('/', {
    schema: {
      tags: ['Procurement - PO'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL', 'RECEIVED', 'INVOICED', 'CLOSED', 'CANCELLED'] },
          supplierId: { type: 'string' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          search: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    const result = await svc(req).list({ companyId: req.user.companyId, ...req.query });
    return reply.send(result);
  });

  // POST /po
  fastify.post('/', {
    schema: {
      tags: ['Procurement - PO'],
      body: {
        type: 'object',
        required: ['supplierId', 'currencyId', 'docDate', 'lines'],
        properties: {
          supplierId: { type: 'string' },
          currencyId: { type: 'string' },
          exchangeRate: { type: 'number', minimum: 0, default: 1 },
          paymentTerms: { type: 'string' },
          incoterms: { type: 'string' },
          docDate: { type: 'string', format: 'date' },
          deliveryDate: { type: 'string', format: 'date' },
          shipToLocationId: { type: 'string' },
          warehouseId: { type: 'string' },
          notes: { type: 'string' },
          lines: { type: 'array', items: lineSchema, minItems: 1 },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const result = await svc(req).create(
      { companyId: req.user.companyId, ...req.body },
      req.user.userId
    );
    return reply.code(201).send(result);
  });

  // GET /po/:id
  fastify.get('/:id', {
    schema: { tags: ['Procurement - PO'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).getById(req.params.id, req.user.companyId);
    return reply.send(result);
  });

  // PUT /po/:id
  fastify.put('/:id', {
    schema: {
      tags: ['Procurement - PO'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          paymentTerms: { type: 'string' },
          incoterms: { type: 'string' },
          deliveryDate: { type: 'string', format: 'date' },
          shipToLocationId: { type: 'string' },
          warehouseId: { type: 'string' },
          notes: { type: 'string' },
          lines: { type: 'array', items: lineSchema },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const result = await svc(req).update(req.params.id, req.user.companyId, req.body, req.user.userId);
    return reply.send(result);
  });

  // POST /po/:id/submit
  fastify.post('/:id/submit', {
    schema: { tags: ['Procurement - PO'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).submit(req.params.id, req.user.companyId, req.user.userId);
    return reply.send(result);
  });

  // POST /po/:id/approve
  fastify.post('/:id/approve', {
    schema: {
      tags: ['Procurement - PO'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: { type: 'object', properties: { comment: { type: 'string' } } },
    },
    preHandler: [PERM.APPROVE],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: { comment?: string } }>, reply: FastifyReply) => {
    const result = await svc(req).approve(req.params.id, req.user.companyId, req.user.userId, req.body?.comment);
    return reply.send(result);
  });

  // POST /po/:id/reject
  fastify.post('/:id/reject', {
    schema: {
      tags: ['Procurement - PO'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: { type: 'object', required: ['comment'], properties: { comment: { type: 'string', minLength: 1 } } },
    },
    preHandler: [PERM.APPROVE],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: { comment: string } }>, reply: FastifyReply) => {
    const result = await svc(req).reject(req.params.id, req.user.companyId, req.user.userId, req.body.comment);
    return reply.send(result);
  });

  // POST /po/:id/cancel
  fastify.post('/:id/cancel', {
    schema: {
      tags: ['Procurement - PO'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 1 } } },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: { reason: string } }>, reply: FastifyReply) => {
    const result = await svc(req).cancel(req.params.id, req.user.companyId, req.user.userId, req.body.reason);
    return reply.send(result);
  });

  // POST /po/:id/short-close
  fastify.post('/:id/short-close', {
    schema: { tags: ['Procurement - PO'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).shortClose(req.params.id, req.user.companyId, req.user.userId);
    return reply.send(result);
  });
}
