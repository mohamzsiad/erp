import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IssueService } from '../../services/inventory/IssueService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('INVENTORY', 'STOCK_ISSUE', 'VIEW'),
  CREATE: requirePermission('INVENTORY', 'STOCK_ISSUE', 'CREATE'),
  POST:   requirePermission('INVENTORY', 'STOCK_ISSUE', 'APPROVE'),
};

const issueLineSchema = {
  type: 'object',
  required: ['itemId', 'uomId', 'issuedQty', 'lineNo'],
  properties: {
    itemId:    { type: 'string' },
    uomId:     { type: 'string' },
    binId:     { type: 'string' },
    issuedQty: { type: 'number', exclusiveMinimum: 0 },
    lineNo:    { type: 'integer', minimum: 1 },
  },
};

export default async function issueRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new IssueService(req.server.prisma);

  // GET /issue
  fastify.get('/', {
    schema: {
      tags: ['Inventory - Issue'],
      querystring: {
        type: 'object',
        properties: {
          status:      { type: 'string', enum: ['DRAFT', 'POSTED', 'CANCELLED'] },
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

  // GET /issue/:id
  fastify.get('/:id', {
    schema: {
      tags: ['Inventory - Issue'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  // POST /issue
  fastify.post('/', {
    schema: {
      tags: ['Inventory - Issue'],
      body: {
        type: 'object',
        required: ['warehouseId', 'docDate', 'chargeCodeId', 'lines'],
        properties: {
          warehouseId:  { type: 'string' },
          docDate:      { type: 'string', format: 'date' },
          chargeCodeId: { type: 'string' },
          mrlId:        { type: 'string' },
          remarks:      { type: 'string' },
          lines:        { type: 'array', items: issueLineSchema, minItems: 1 },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(
      await svc(req).create(req.body, req.user.companyId, req.user.userId),
    );
  });

  // POST /issue/:id/post
  fastify.post('/:id/post', {
    schema: {
      tags: ['Inventory - Issue'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.POST],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).post(req.params.id, req.user.companyId, req.user.userId));
  });

  // POST /issue/:id/cancel
  fastify.post('/:id/cancel', {
    schema: {
      tags: ['Inventory - Issue'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).cancel(req.params.id, req.user.companyId));
  });
}
