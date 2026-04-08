import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BinService } from '../../services/inventory/BinService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('INVENTORY', 'BIN', 'VIEW'),
  CREATE: requirePermission('INVENTORY', 'BIN', 'CREATE'),
  EDIT:   requirePermission('INVENTORY', 'BIN', 'EDIT'),
  DELETE: requirePermission('INVENTORY', 'BIN', 'DELETE'),
};

export default async function binRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new BinService(req.server.prisma);

  // GET /bins
  fastify.get('/', {
    schema: {
      tags: ['Inventory - Bins'],
      querystring: {
        type: 'object',
        properties: {
          warehouseId: { type: 'string' },
          search:      { type: 'string' },
          isActive:    { type: 'boolean' },
          page:        { type: 'integer', minimum: 1, default: 1 },
          limit:       { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).list({ companyId: req.user.companyId, ...req.query }));
  });

  // GET /bins/:id
  fastify.get('/:id', {
    schema: {
      tags: ['Inventory - Bins'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  // POST /bins
  fastify.post('/', {
    schema: {
      tags: ['Inventory - Bins'],
      body: {
        type: 'object',
        required: ['warehouseId', 'code'],
        properties: {
          warehouseId: { type: 'string' },
          code:        { type: 'string' },
          name:        { type: 'string' },
          zone:        { type: 'string' },
          aisle:       { type: 'string' },
          rack:        { type: 'string' },
          level:       { type: 'string' },
          maxWeight:   { type: 'number', minimum: 0 },
          isActive:    { type: 'boolean', default: true },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(await svc(req).create(req.body, req.user.companyId));
  });

  // PATCH /bins/:id
  fastify.patch('/:id', {
    schema: {
      tags: ['Inventory - Bins'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).update(req.params.id, req.body, req.user.companyId));
  });

  // DELETE /bins/:id
  fastify.delete('/:id', {
    schema: {
      tags: ['Inventory - Bins'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.DELETE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await svc(req).delete(req.params.id, req.user.companyId);
    return reply.code(204).send();
  });
}
