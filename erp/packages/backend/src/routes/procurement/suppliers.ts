import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SupplierService } from '../../services/procurement/SupplierService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW: requirePermission('PROCUREMENT', 'SUPPLIERS', 'VIEW'),
  CREATE: requirePermission('PROCUREMENT', 'SUPPLIERS', 'CREATE'),
  EDIT: requirePermission('PROCUREMENT', 'SUPPLIERS', 'EDIT'),
};

export default async function supplierRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) =>
    new SupplierService(req.server.prisma);

  // ── GET /suppliers/search ─────────────────────────────────────────────────
  fastify.get('/search', {
    schema: {
      tags: ['Procurement - Suppliers'],
      querystring: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: ['q'],
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: { q: string } }>, reply: FastifyReply) => {
    const results = await svc(req).search(req.user.companyId, req.query.q);
    return reply.send(results);
  });

  // ── GET /suppliers ─────────────────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      tags: ['Procurement - Suppliers'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          isActive: { type: 'boolean' },
          locationId: { type: 'string' },
          supplierId: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{
    Querystring: { search?: string; isActive?: boolean; locationId?: string; supplierId?: string; page?: number; limit?: number };
  }>, reply: FastifyReply) => {
    const result = await svc(req).list({ companyId: req.user.companyId, ...req.query });
    return reply.send(result);
  });

  // ── POST /suppliers ────────────────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      tags: ['Procurement - Suppliers'],
      body: {
        type: 'object',
        required: ['locationId', 'name', 'shortName'],
        properties: {
          locationId: { type: 'string' },
          name: { type: 'string', maxLength: 200 },
          shortName: { type: 'string', maxLength: 100 },
          controlAccountId: { type: 'string', nullable: true },
          creditDays: { type: 'integer', minimum: 0, default: 0 },
          creditAmount: { type: 'number', minimum: 0, default: 0 },
          parentSupplierId: { type: 'string', nullable: true },
          shipmentMode: { type: 'string', enum: ['AIR', 'SEA', 'LAND', 'NA'], default: 'NA' },
          isTdsApplicable: { type: 'boolean', default: false },
          isTdsParty: { type: 'boolean', default: false },
          isParentSupplier: { type: 'boolean', default: false },
          contacts: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
                designation: { type: 'string' },
                email: { type: 'string', format: 'email' },
                phone: { type: 'string' },
                isPrimary: { type: 'boolean' },
              },
            },
          },
          bankDetails: {
            type: 'array',
            items: {
              type: 'object',
              required: ['bankName', 'accountNo'],
              properties: {
                bankName: { type: 'string' },
                accountNo: { type: 'string' },
                iban: { type: 'string' },
                swiftCode: { type: 'string' },
              },
            },
          },
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

  // ── GET /suppliers/:id ─────────────────────────────────────────────────────
  fastify.get('/:id', {
    schema: {
      tags: ['Procurement - Suppliers'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).getById(req.params.id, req.user.companyId);
    return reply.send(result);
  });

  // ── PUT /suppliers/:id ─────────────────────────────────────────────────────
  fastify.put('/:id', {
    schema: {
      tags: ['Procurement - Suppliers'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          shortName: { type: 'string' },
          controlAccountId: { type: 'string', nullable: true },
          creditDays: { type: 'integer', minimum: 0 },
          creditAmount: { type: 'number', minimum: 0 },
          parentSupplierId: { type: 'string', nullable: true },
          shipmentMode: { type: 'string', enum: ['AIR', 'SEA', 'LAND', 'NA'] },
          isTdsApplicable: { type: 'boolean' },
          isTdsParty: { type: 'boolean' },
          isParentSupplier: { type: 'boolean' },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const result = await svc(req).update(req.params.id, req.user.companyId, req.body, req.user.userId);
    return reply.send(result);
  });

  // ── POST /suppliers/:id/activate ───────────────────────────────────────────
  fastify.post('/:id/activate', {
    schema: {
      tags: ['Procurement - Suppliers'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [requirePermission('CORE', 'CONFIG', 'CONFIGURE')],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).toggleActive(req.params.id, req.user.companyId, req.user.userId);
    return reply.send(result);
  });

  // ── GET /suppliers/:id/statement ───────────────────────────────────────────
  fastify.get('/:id/statement', {
    schema: {
      tags: ['Procurement - Suppliers'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).getStatement(req.params.id, req.user.companyId);
    return reply.send(result);
  });
}
