import { FastifyInstance } from 'fastify';
import { SalesQuotationService } from '../../services/sales/SalesQuotationService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('SALES', 'SALES_QUOTATION', 'VIEW'),
  CREATE: requirePermission('SALES', 'SALES_QUOTATION', 'CREATE'),
  EDIT:   requirePermission('SALES', 'SALES_QUOTATION', 'EDIT'),
};

const lineSchema = {
  type: 'object', required: ['itemId', 'uomId', 'qty'],
  properties: {
    itemId: { type: 'string' }, description: { type: 'string', nullable: true }, uomId: { type: 'string' },
    qty: { type: 'number', minimum: 0 }, unitPrice: { type: 'number', nullable: true },
    discountPct: { type: 'number', minimum: 0, maximum: 100 }, taxCodeId: { type: 'string', nullable: true },
  },
};
const bodyProps = {
  customerId: { type: 'string' }, enquiryId: { type: 'string', nullable: true },
  quotationDate: { type: 'string' }, validTo: { type: 'string', nullable: true },
  paymentTerms: { type: 'string', nullable: true }, salespersonId: { type: 'string', nullable: true },
  notes: { type: 'string', nullable: true }, lines: { type: 'array', items: lineSchema },
};

export default async function quotationRoutes(fastify: FastifyInstance) {
  const svc = () => new SalesQuotationService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; status?: string; customerId?: string; page?: number; limit?: number } }>('/', {
    schema: { tags: ['Sales - Quotations'], querystring: { type: 'object', properties: {
      search: { type: 'string' }, status: { type: 'string' }, customerId: { type: 'string' },
      page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Sales - Quotations'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Quotations'], body: { type: 'object', required: ['customerId', 'quotationDate', 'lines'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => {
    const r = await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId);
    return reply.code(201).send(r);
  });

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: { tags: ['Sales - Quotations'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, body: { type: 'object', properties: bodyProps } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId)));

  fastify.post<{ Params: { id: string }; Body: { status: string } }>('/:id/status', {
    schema: { tags: ['Sales - Quotations'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] } } } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().setStatus(req.params.id, req.user.companyId, req.body.status as any, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/revise', {
    schema: { tags: ['Sales - Quotations'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.code(201).send(await svc().revise(req.params.id, req.user.companyId, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/convert-to-order', {
    schema: { tags: ['Sales - Quotations'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.code(201).send(await svc().convertToOrder(req.params.id, req.user.companyId, req.user.userId)));

  // Print view (JSON) — the frontend renders/prints this.
  fastify.get<{ Params: { id: string } }>('/:id/print', {
    schema: { tags: ['Sales - Quotations'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  // Send to customer — marks SENT and queues a notification (email stub).
  fastify.post<{ Params: { id: string } }>('/:id/send', {
    schema: { tags: ['Sales - Quotations'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => {
    const q = await svc().setStatus(req.params.id, req.user.companyId, 'SENT', req.user.userId);
    await fastify.prisma.notification.create({
      data: {
        userId: req.user.userId, type: 'QUOTATION_SENT', title: 'Quotation sent',
        message: `Quotation ${q.docNo} was marked as sent to the customer.`, docType: 'SQL', docId: q.id,
      },
    });
    return reply.send({ ok: true, status: 'SENT' });
  });
}
