import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApService } from '../../services/finance/ApService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('FINANCE', 'AP', 'VIEW'),
  CREATE: requirePermission('FINANCE', 'AP', 'CREATE'),
  EDIT:   requirePermission('FINANCE', 'AP', 'EDIT'),
};

const allocationSchema = {
  type: 'object',
  required: ['invoiceId', 'amount'],
  properties: {
    invoiceId: { type: 'string' },
    amount:    { type: 'number', minimum: 0 },
  },
};

export default async function apRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new ApService(req.server.prisma);

  // ── Invoices ──────────────────────────────────────────────────────────────

  // GET /ap/invoices
  fastify.get('/invoices', {
    schema: {
      tags: ['Finance - AP'],
      querystring: {
        type: 'object',
        properties: {
          status:     { type: 'string', enum: ['DRAFT', 'APPROVED', 'PARTIAL', 'PAID', 'CANCELLED'] },
          supplierId: { type: 'string' },
          dateFrom:   { type: 'string', format: 'date' },
          dateTo:     { type: 'string', format: 'date' },
          page:       { type: 'integer', minimum: 1, default: 1 },
          limit:      { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).listInvoices(req.user.companyId, req.query));
  });

  // GET /ap/invoices/:id
  fastify.get('/invoices/:id', {
    schema: {
      tags: ['Finance - AP'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getInvoiceById(req.params.id, req.user.companyId));
  });

  // POST /ap/invoices
  fastify.post('/invoices', {
    schema: {
      tags: ['Finance - AP'],
      body: {
        type: 'object',
        required: ['supplierId', 'supplierInvoiceNo', 'invoiceDate', 'dueDate', 'amount'],
        properties: {
          supplierId:         { type: 'string' },
          poId:               { type: 'string' },
          grnId:              { type: 'string' },
          supplierInvoiceNo:  { type: 'string', minLength: 1 },
          invoiceDate:        { type: 'string', format: 'date' },
          dueDate:            { type: 'string', format: 'date' },
          amount:             { type: 'number', minimum: 0 },
          taxAmount:          { type: 'number', minimum: 0 },
          expenseAccountId:   { type: 'string' },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const invoice = await svc(req).createInvoice(req.user.companyId, req.body, req.user.userId);
    return reply.code(201).send(invoice);
  });

  // POST /ap/invoices/:id/approve
  fastify.post('/invoices/:id/approve', {
    schema: {
      tags: ['Finance - AP'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).approveInvoice(req.params.id, req.user.companyId, req.user.userId));
  });

  // POST /ap/invoices/:id/cancel
  fastify.post('/invoices/:id/cancel', {
    schema: {
      tags: ['Finance - AP'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).cancelInvoice(req.params.id, req.user.companyId, req.user.userId));
  });

  // ── Payments ──────────────────────────────────────────────────────────────

  // GET /ap/payments
  fastify.get('/payments', {
    schema: {
      tags: ['Finance - AP'],
      querystring: {
        type: 'object',
        properties: {
          supplierId: { type: 'string' },
          dateFrom:   { type: 'string', format: 'date' },
          dateTo:     { type: 'string', format: 'date' },
          page:       { type: 'integer', minimum: 1, default: 1 },
          limit:      { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).listPayments(req.user.companyId, req.query));
  });

  // POST /ap/payments
  fastify.post('/payments', {
    schema: {
      tags: ['Finance - AP'],
      body: {
        type: 'object',
        required: ['supplierId', 'paymentDate', 'amount', 'paymentMethod', 'allocations'],
        properties: {
          supplierId:    { type: 'string' },
          paymentDate:   { type: 'string', format: 'date' },
          amount:        { type: 'number', minimum: 0 },
          paymentMethod: { type: 'string', enum: ['BANK_TRANSFER', 'CHEQUE', 'CASH'] },
          bankAccountId: { type: 'string' },
          notes:         { type: 'string' },
          allocations:   { type: 'array', items: allocationSchema, minItems: 1 },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const payment = await svc(req).createPayment(req.user.companyId, req.body, req.user.userId);
    return reply.code(201).send(payment);
  });
}
