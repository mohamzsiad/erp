import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WarehouseService } from '../../services/inventory/WarehouseService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('INVENTORY', 'WAREHOUSES', 'VIEW'),
  CREATE: requirePermission('INVENTORY', 'WAREHOUSES', 'CREATE'),
  EDIT:   requirePermission('INVENTORY', 'WAREHOUSES', 'EDIT'),
  DELETE: requirePermission('INVENTORY', 'WAREHOUSES', 'DELETE'),
};

export default async function warehouseRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new WarehouseService(req.server.prisma);

  // GET /warehouses
  fastify.get('/', {
    schema: {
      tags: ['Inventory - Warehouses'],
      querystring: {
        type: 'object',
        properties: {
          search:   { type: 'string' },
          isActive: { type: 'boolean' },
          page:     { type: 'integer', minimum: 1, default: 1 },
          limit:    { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).list({ companyId: req.user.companyId, ...req.query }));
  });

  // GET /warehouses/:id
  fastify.get('/:id', {
    schema: {
      tags: ['Inventory - Warehouses'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  // GET /warehouses/:id/stock-summary
  fastify.get('/:id/stock-summary', {
    schema: {
      tags: ['Inventory - Warehouses'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getStockSummary(req.params.id, req.user.companyId));
  });

  // POST /warehouses
  fastify.post('/', {
    schema: {
      tags: ['Inventory - Warehouses'],
      body: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code:       { type: 'string' },
          name:       { type: 'string' },
          locationId: { type: 'string' },
          address:    { type: 'string' },
          isActive:   { type: 'boolean', default: true },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(await svc(req).create(req.body, req.user.companyId, req.user.userId));
  });

  // PATCH /warehouses/:id
  fastify.patch('/:id', {
    schema: {
      tags: ['Inventory - Warehouses'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).update(req.params.id, req.body, req.user.companyId));
  });

  // DELETE /warehouses/:id
  fastify.delete('/:id', {
    schema: {
      tags: ['Inventory - Warehouses'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.DELETE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await svc(req).delete(req.params.id, req.user.companyId);
    return reply.code(204).send();
  });
}
