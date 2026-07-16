import { FastifyInstance } from 'fastify';
import { SalesInvoiceService } from '../../services/sales/SalesInvoiceService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('SALES', 'SALES_INVOICE', 'VIEW'),
  CREATE: requirePermission('SALES', 'SALES_INVOICE', 'CREATE'),
  EDIT:   requirePermission('SALES', 'SALES_INVOICE', 'EDIT'),
};

const lineSchema = {
  type: 'object', required: ['itemId', 'uomId', 'qty', 'unitPrice'],
  properties: {
    itemId: { type: 'string' }, description: { type: 'string', nullable: true }, uomId: { type: 'string' },
    qty: { type: 'number', minimum: 0 }, unitPrice: { type: 'number', minimum: 0 },
    discountPct: { type: 'number', minimum: 0, maximum: 100 }, taxCodeId: { type: 'string', nullable: true },
  },
};
const bodyProps = {
  customerId: { type: 'string' }, deliveryNoteId: { type: 'string', nullable: true }, salesOrderId: { type: 'string', nullable: true },
  invoiceDate: { type: 'string' }, dueDate: { type: 'string', nullable: true }, description: { type: 'string', nullable: true },
  lines: { type: 'array', items: lineSchema },
};
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export default async function invoiceRoutes(fastify: FastifyInstance) {
  const svc = () => new SalesInvoiceService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; status?: string; customerId?: string; page?: number; limit?: number } }>('/', {
    schema: { tags: ['Sales - Invoices'], querystring: { type: 'object', properties: {
      search: { type: 'string' }, status: { type: 'string' }, customerId: { type: 'string' },
      page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Sales - Invoices'], params: idParam }, preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  // Printable tax invoice (JSON) — the frontend renders/prints this.
  fastify.get<{ Params: { id: string } }>('/:id/print', {
    schema: { tags: ['Sales - Invoices'], params: idParam }, preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Invoices'], body: { type: 'object', required: ['customerId', 'invoiceDate', 'lines'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId)));

  fastify.post<{ Params: { deliveryNoteId: string } }>('/from-delivery/:deliveryNoteId', {
    schema: { tags: ['Sales - Invoices'], params: { type: 'object', required: ['deliveryNoteId'], properties: { deliveryNoteId: { type: 'string' } } } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().createFromDelivery(req.params.deliveryNoteId, req.user.companyId, req.user.userId)));

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: { tags: ['Sales - Invoices'], params: idParam, body: { type: 'object', properties: bodyProps } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/post', {
    schema: { tags: ['Sales - Invoices'], params: idParam }, preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().post(req.params.id, req.user.companyId, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/cancel', {
    schema: { tags: ['Sales - Invoices'], params: idParam }, preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().cancel(req.params.id, req.user.companyId, req.user.userId)));
}
