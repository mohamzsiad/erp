import { FastifyInstance } from 'fastify';
import { PriceListService } from '../../services/sales/PriceListService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('SALES', 'PRICE_LIST', 'VIEW'),
  CREATE: requirePermission('SALES', 'PRICE_LIST', 'CREATE'),
  EDIT:   requirePermission('SALES', 'PRICE_LIST', 'EDIT'),
};

const itemSchema = {
  type: 'object',
  required: ['itemId', 'uomId', 'unitPrice'],
  properties: {
    itemId: { type: 'string' },
    uomId: { type: 'string' },
    unitPrice: { type: 'number', minimum: 0 },
    minPrice: { type: 'number', minimum: 0 },
    validFrom: { type: 'string', nullable: true },
    validTo: { type: 'string', nullable: true },
  },
};

const headerProps = {
  name: { type: 'string', maxLength: 150 },
  currencyId: { type: 'string', nullable: true },
  validFrom: { type: 'string', nullable: true },
  validTo: { type: 'string', nullable: true },
  isActive: { type: 'boolean' },
  isDefault: { type: 'boolean' },
  items: { type: 'array', items: itemSchema },
};

export default async function priceListRoutes(fastify: FastifyInstance) {
  const svc = () => new PriceListService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; isActive?: boolean } }>('/', {
    schema: {
      tags: ['Sales - Price Lists'],
      querystring: { type: 'object', properties: { search: { type: 'string' }, isActive: { type: 'boolean' } } },
    },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => {
    return reply.send(await svc().list(req.user.companyId, req.query));
  });

  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Sales - Price Lists'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => {
    return reply.send(await svc().getById(req.params.id, req.user.companyId));
  });

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Price Lists'], body: { type: 'object', required: ['name'], properties: headerProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => {
    const result = await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId);
    return reply.code(201).send(result);
  });

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: {
      tags: ['Sales - Price Lists'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', properties: headerProps },
    },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => {
    return reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId));
  });

  fastify.post<{ Params: { id: string } }>('/:id/set-default', {
    schema: {
      tags: ['Sales - Price Lists'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => {
    return reply.send(await svc().setDefault(req.params.id, req.user.companyId, req.user.userId));
  });

  fastify.post<{ Params: { id: string } }>('/:id/toggle-active', {
    schema: {
      tags: ['Sales - Price Lists'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => {
    return reply.send(await svc().toggleActive(req.params.id, req.user.companyId, req.user.userId));
  });

  fastify.post<{ Params: { id: string }; Body: { items: any[] } }>('/:id/items', {
    schema: {
      tags: ['Sales - Price Lists'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: itemSchema } } },
    },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => {
    return reply.send(await svc().bulkUpsertItems(req.params.id, req.user.companyId, req.body.items, req.user.userId));
  });

  fastify.delete<{ Params: { id: string; itemRowId: string } }>('/:id/items/:itemRowId', {
    schema: {
      tags: ['Sales - Price Lists'],
      params: { type: 'object', required: ['id', 'itemRowId'], properties: { id: { type: 'string' }, itemRowId: { type: 'string' } } },
    },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => {
    return reply.send(await svc().deleteItem(req.params.id, req.user.companyId, req.params.itemRowId, req.user.userId));
  });

  fastify.post<{ Params: { id: string }; Body: { targetType: 'CUSTOMER' | 'CATEGORY'; targetId: string } }>('/:id/assign', {
    schema: {
      tags: ['Sales - Price Lists'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['targetType', 'targetId'],
        properties: { targetType: { type: 'string', enum: ['CUSTOMER', 'CATEGORY'] }, targetId: { type: 'string' } },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => {
    return reply.send(await svc().assign(req.params.id, req.user.companyId, req.body.targetType, req.body.targetId, req.user.userId));
  });
}
