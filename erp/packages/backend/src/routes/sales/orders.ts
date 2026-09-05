import { FastifyInstance } from 'fastify';
import { SalesOrderService } from '../../services/sales/SalesOrderService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:    requirePermission('SALES', 'SALES_ORDER', 'VIEW'),
  CREATE:  requirePermission('SALES', 'SALES_ORDER', 'CREATE'),
  EDIT:    requirePermission('SALES', 'SALES_ORDER', 'EDIT'),
  APPROVE: requirePermission('SALES', 'SALES_ORDER', 'APPROVE'),
  RELEASE: requirePermission('SALES', 'CREDIT_CONTROL', 'APPROVE'),
};

const lineSchema = {
  type: 'object', required: ['itemId', 'uomId', 'orderedQty'],
  properties: {
    itemId: { type: 'string' }, description: { type: 'string', nullable: true }, uomId: { type: 'string' },
    orderedQty: { type: 'number', minimum: 0 }, unitPrice: { type: 'number', nullable: true },
    discountPct: { type: 'number', minimum: 0, maximum: 100 }, taxCodeId: { type: 'string', nullable: true },
    requestedDate: { type: 'string', nullable: true },
    reservedQty: { type: 'number', minimum: 0 }, reserveWarehouseId: { type: 'string', nullable: true },
    reserveUntil: { type: 'string', nullable: true },
  },
};
const bodyProps = {
  customerId: { type: 'string' }, quotationId: { type: 'string', nullable: true }, contractId: { type: 'string', nullable: true },
  orderType: { type: 'string', enum: ['STOCK', 'SERVICE', 'PROJECT', 'DIRECT'] }, orderDate: { type: 'string' },
  requestedDate: { type: 'string', nullable: true }, billToAddressId: { type: 'string', nullable: true }, shipToAddressId: { type: 'string', nullable: true },
  salespersonId: { type: 'string', nullable: true }, salesmanId: { type: 'string', nullable: true },
  paymentTerms: { type: 'string', nullable: true }, paymentTermId: { type: 'string', nullable: true },
  currencyId: { type: 'string', nullable: true }, exchangeRate: { type: 'number', minimum: 0 },
  locationId: { type: 'string', nullable: true }, warehouseId: { type: 'string', nullable: true },
  notes: { type: 'string', nullable: true }, lines: { type: 'array', items: lineSchema },
};
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export default async function orderRoutes(fastify: FastifyInstance) {
  const svc = () => new SalesOrderService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; status?: string; customerId?: string; page?: number; limit?: number } }>('/', {
    schema: { tags: ['Sales - Orders'], querystring: { type: 'object', properties: {
      search: { type: 'string' }, status: { type: 'string' }, customerId: { type: 'string' },
      page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Sales - Orders'], params: idParam }, preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.get<{ Params: { id: string } }>('/:id/availability', {
    schema: { tags: ['Sales - Orders'], params: idParam }, preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().availability(req.params.id, req.user.companyId)));

  // Terms spooled off the customer master when the header is first filled in.
  fastify.get<{ Querystring: { customerId: string } }>('/customer-defaults', {
    schema: {
      tags: ['Sales - Orders'],
      querystring: { type: 'object', required: ['customerId'], properties: { customerId: { type: 'string' } } },
    },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().spoolCustomerDefaults(req.user.companyId, req.query.customerId)));

  // Warehouse + group stock for an item, for the two stock columns on the line.
  fastify.get<{ Querystring: { itemId: string; warehouseId?: string } }>('/item-stock', {
    schema: {
      tags: ['Sales - Orders'],
      querystring: {
        type: 'object', required: ['itemId'],
        properties: { itemId: { type: 'string' }, warehouseId: { type: 'string' } },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().itemStock(req.user.companyId, req.query.itemId, req.query.warehouseId)));

  // Block stock for a line — optionally from a warehouse other than the order's.
  fastify.post<{ Params: { id: string; lineId: string }; Body: { qty: number; warehouseId?: string | null; reserveUntil?: string | null } }>('/:id/lines/:lineId/reserve', {
    schema: {
      tags: ['Sales - Orders'],
      params: { type: 'object', required: ['id', 'lineId'], properties: { id: { type: 'string' }, lineId: { type: 'string' } } },
      body: {
        type: 'object', required: ['qty'],
        properties: { qty: { type: 'number', minimum: 0 }, warehouseId: { type: 'string', nullable: true }, reserveUntil: { type: 'string', nullable: true } },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().reserveLine(req.params.id, req.params.lineId, req.user.companyId, req.body, req.user.userId)));

  fastify.post<{ Params: { id: string; lineId: string } }>('/:id/lines/:lineId/release-reservation', {
    schema: {
      tags: ['Sales - Orders'],
      params: { type: 'object', required: ['id', 'lineId'], properties: { id: { type: 'string' }, lineId: { type: 'string' } } },
    },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().releaseLine(req.params.id, req.params.lineId, req.user.companyId, req.user.userId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Orders'], body: { type: 'object', required: ['customerId', 'orderDate'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId)));

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: { tags: ['Sales - Orders'], params: idParam, body: { type: 'object', properties: bodyProps } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/confirm', {
    schema: { tags: ['Sales - Orders'], params: idParam }, preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().confirm(req.params.id, req.user.companyId, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/approve', {
    schema: { tags: ['Sales - Orders'], params: idParam }, preHandler: [PERM.APPROVE],
  }, async (req, reply) => reply.send(await svc().approve(req.params.id, req.user.companyId, req.user.userId)));

  fastify.post<{ Params: { id: string }; Body: { reason?: string } }>('/:id/reject', {
    schema: { tags: ['Sales - Orders'], params: idParam, body: { type: 'object', properties: { reason: { type: 'string' } } } },
    preHandler: [PERM.APPROVE],
  }, async (req, reply) => reply.send(await svc().reject(req.params.id, req.user.companyId, req.user.userId, req.body?.reason)));

  fastify.post<{ Params: { id: string } }>('/:id/release-hold', {
    schema: { tags: ['Sales - Orders'], params: idParam }, preHandler: [PERM.RELEASE],
  }, async (req, reply) => reply.send(await svc().releaseHold(req.params.id, req.user.companyId, req.user.userId)));

  fastify.post<{ Params: { id: string }; Body: { reason?: string } }>('/:id/cancel', {
    schema: { tags: ['Sales - Orders'], params: idParam, body: { type: 'object', properties: { reason: { type: 'string' } } } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().cancel(req.params.id, req.user.companyId, req.user.userId, req.body?.reason)));

  fastify.post<{ Params: { id: string } }>('/:id/short-close', {
    schema: { tags: ['Sales - Orders'], params: idParam }, preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().shortClose(req.params.id, req.user.companyId, req.user.userId)));
}
