import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TransferService } from '../../services/inventory/TransferService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('INVENTORY', 'TRANSFER', 'VIEW'),
  CREATE: requirePermission('INVENTORY', 'TRANSFER', 'CREATE'),
  POST:   requirePermission('INVENTORY', 'TRANSFER', 'APPROVE'),
};

const transferLineSchema = {
  type: 'object',
  required: ['itemId', 'uomId', 'transferQty', 'lineNo'],
  properties: {
    itemId:      { type: 'string' },
    uomId:       { type: 'string' },
    fromBinId:   { type: 'string' },
    toBinId:     { type: 'string' },
    transferQty: { type: 'number', exclusiveMinimum: 0 },
    lineNo:      { type: 'integer', minimum: 1 },
  },
};

export default async function transferRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new TransferService(req.server.prisma);

  // GET /transfer
  fastify.get('/', {
    schema: {
      tags: ['Inventory - Transfer'],
      querystring: {
        type: 'object',
        properties: {
          status:          { type: 'string', enum: ['DRAFT', 'POSTED', 'CANCELLED'] },
          fromWarehouseId: { type: 'string' },
          toWarehouseId:   { type: 'string' },
          dateFrom:        { type: 'string', format: 'date' },
          dateTo:          { type: 'string', format: 'date' },
          search:          { type: 'string' },
          page:            { type: 'integer', minimum: 1, default: 1 },
          limit:           { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).list({ companyId: req.user.companyId, ...req.query }));
  });

  // GET /transfer/:id
  fastify.get('/:id', {
    schema: {
      tags: ['Inventory - Transfer'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  // POST /transfer
  fastify.post('/', {
    schema: {
      tags: ['Inventory - Transfer'],
      body: {
        type: 'object',
        required: ['fromWarehouseId', 'toWarehouseId', 'docDate', 'lines'],
        properties: {
          fromWarehouseId: { type: 'string' },
          toWarehouseId:   { type: 'string' },
          docDate:         { type: 'string', format: 'date' },
          remarks:         { type: 'string' },
          lines:           { type: 'array', items: transferLineSchema, minItems: 1 },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(
      await svc(req).create(req.body, req.user.companyId, req.user.userId),
    );
  });

  // POST /transfer/:id/post
  fastify.post('/:id/post', {
    schema: {
      tags: ['Inventory - Transfer'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.POST],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).post(req.params.id, req.user.companyId, req.user.userId));
  });

  // POST /transfer/:id/cancel
  fastify.post('/:id/cancel', {
    schema: {
      tags: ['Inventory - Transfer'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).cancel(req.params.id, req.user.companyId));
  });
}
