import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GrnService } from '../../services/inventory/GrnService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('INVENTORY', 'GRN', 'VIEW'),
  CREATE: requirePermission('INVENTORY', 'GRN', 'CREATE'),
  EDIT:   requirePermission('INVENTORY', 'GRN', 'EDIT'),
  POST:   requirePermission('INVENTORY', 'GRN', 'APPROVE'),
};

const grnLineSchema = {
  type: 'object',
  required: ['itemId', 'poLineId', 'receivedQty', 'acceptedQty', 'lineNo'],
  properties: {
    itemId:      { type: 'string' },
    poLineId:    { type: 'string' },
    receivedQty: { type: 'number', exclusiveMinimum: 0 },
    acceptedQty: { type: 'number', minimum: 0 },
    rejectedQty: { type: 'number', minimum: 0, default: 0 },
    binId:       { type: 'string' },
    lotNo:       { type: 'string' },
    batchNo:     { type: 'string' },
    expiryDate:  { type: 'string', format: 'date' },
    lineNo:      { type: 'integer', minimum: 1 },
  },
};

export default async function grnRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new GrnService(req.server.prisma);

  // GET /grn
  fastify.get('/', {
    schema: {
      tags: ['Inventory - GRN'],
      querystring: {
        type: 'object',
        properties: {
          status:     { type: 'string', enum: ['DRAFT', 'POSTED', 'CANCELLED'] },
          supplierId: { type: 'string' },
          poId:       { type: 'string' },
          dateFrom:   { type: 'string', format: 'date' },
          dateTo:     { type: 'string', format: 'date' },
          search:     { type: 'string' },
          page:       { type: 'integer', minimum: 1, default: 1 },
          limit:      { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).list({ companyId: req.user.companyId, ...req.query }));
  });

  // GET /grn/:id
  fastify.get('/:id', {
    schema: {
      tags: ['Inventory - GRN'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  // POST /grn
  fastify.post('/', {
    schema: {
      tags: ['Inventory - GRN'],
      body: {
        type: 'object',
        required: ['poId', 'warehouseId', 'docDate', 'lines'],
        properties: {
          poId:        { type: 'string' },
          warehouseId: { type: 'string' },
          locationId:  { type: 'string' },
          docDate:     { type: 'string', format: 'date' },
          remarks:     { type: 'string' },
          lines:       { type: 'array', items: grnLineSchema, minItems: 1 },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(
      await svc(req).create(req.body, req.user.companyId, req.user.userId),
    );
  });

  // PATCH /grn/:id
  fastify.patch('/:id', {
    schema: {
      tags: ['Inventory - GRN'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).update(req.params.id, req.user.companyId, req.body));
  });

  // POST /grn/:id/post
  fastify.post('/:id/post', {
    schema: {
      tags: ['Inventory - GRN'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.POST],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).post(req.params.id, req.user.companyId, req.user.userId));
  });

  // POST /grn/:id/cancel
  fastify.post('/:id/cancel', {
    schema: {
      tags: ['Inventory - GRN'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).cancel(req.params.id, req.user.companyId));
  });
}
