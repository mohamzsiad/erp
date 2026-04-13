import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ItemService } from '../../services/inventory/ItemService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('INVENTORY', 'ITEMS', 'VIEW'),
  CREATE: requirePermission('INVENTORY', 'ITEMS', 'CREATE'),
  EDIT:   requirePermission('INVENTORY', 'ITEMS', 'EDIT'),
  DELETE: requirePermission('INVENTORY', 'ITEMS', 'DELETE'),
};

export default async function itemRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new ItemService(req.server.prisma);

  // GET /items
  fastify.get('/', {
    schema: {
      tags: ['Inventory - Items'],
      querystring: {
        type: 'object',
        properties: {
          search:     { type: 'string' },
          categoryId: { type: 'string' },
          uomId:      { type: 'string' },
          status:     { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'OBSOLETE'] },
          page:       { type: 'integer', minimum: 1, default: 1 },
          limit:      { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).list({ companyId: req.user.companyId, ...req.query }));
  });

  // GET /items/search — lightweight dropdown search
  fastify.get('/search', {
    schema: {
      tags: ['Inventory - Items'],
      querystring: {
        type: 'object',
        properties: {
          q:     { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).search(req.user.companyId, req.query.q ?? '', req.query.limit));
  });

  // GET /items/reorder-alerts
  fastify.get('/reorder-alerts', {
    schema: { tags: ['Inventory - Items'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).getReorderAlerts(req.user.companyId));
  });

  // GET /items/categories
  fastify.get('/categories', {
    schema: { tags: ['Inventory - Items'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).listCategories(req.user.companyId));
  });

  // POST /items/categories
  fastify.post('/categories', {
    schema: {
      tags: ['Inventory - Items'],
      body: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code:        { type: 'string' },
          name:        { type: 'string' },
          description: { type: 'string' },
          parentId:    { type: 'string' },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(await svc(req).createCategory(req.user.companyId, req.body));
  });

  // GET /items/uoms
  fastify.get('/uoms', {
    schema: { tags: ['Inventory - Items'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).listUoms(req.user.companyId));
  });

  // GET /items/:id
  fastify.get('/:id', {
    schema: {
      tags: ['Inventory - Items'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  // GET /items/:id/stock
  fastify.get('/:id/stock', {
    schema: {
      tags: ['Inventory - Items'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getItemStock(req.params.id, req.user.companyId));
  });

  // GET /items/:id/transactions
  fastify.get('/:id/transactions', {
    schema: {
      tags: ['Inventory - Items'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: {
        type: 'object',
        properties: {
          dateFrom:    { type: 'string', format: 'date' },
          dateTo:      { type: 'string', format: 'date' },
          warehouseId: { type: 'string' },
          page:        { type: 'integer', minimum: 1, default: 1 },
          limit:       { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string }; Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getTransactions(req.params.id, req.user.companyId, req.query));
  });

  // POST /items
  fastify.post('/', {
    schema: {
      tags: ['Inventory - Items'],
      body: {
        type: 'object',
        required: ['code', 'description', 'uomId', 'categoryId'],
        properties: {
          code:           { type: 'string' },
          description:    { type: 'string' },
          uomId:          { type: 'string' },
          categoryId:     { type: 'string' },
          barcode:        { type: 'string' },
          reorderLevel:   { type: 'number', minimum: 0, default: 0 },
          reorderQty:     { type: 'number', minimum: 0, default: 0 },
          leadTimeDays:   { type: 'integer', minimum: 0, default: 0 },
          minOrderQty:    { type: 'number', minimum: 0, default: 1 },
          standardCost:   { type: 'number', minimum: 0, default: 0 },
          safetyStock:    { type: 'number', minimum: 0, default: 0 },
          isSerialized:   { type: 'boolean', default: false },
          isBatchTracked: { type: 'boolean', default: false },
          imageUrl:       { type: 'string' },
          notes:          { type: 'string' },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(await svc(req).create(req.body, req.user.companyId, req.user.userId));
  });

  // PATCH /items/:id
  fastify.patch('/:id', {
    schema: {
      tags: ['Inventory - Items'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).update(req.params.id, req.body, req.user.companyId));
  });

  // DELETE /items/:id
  fastify.delete('/:id', {
    schema: {
      tags: ['Inventory - Items'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.DELETE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await svc(req).delete(req.params.id, req.user.companyId);
    return reply.code(204).send();
  });
}
