import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ArService } from '../../services/finance/ArService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('FINANCE', 'AR', 'VIEW'),
  CREATE: requirePermission('FINANCE', 'AR', 'CREATE'),
  EDIT:   requirePermission('FINANCE', 'AR', 'EDIT'),
};

const allocationSchema = {
  type: 'object',
  required: ['invoiceId', 'amount'],
  properties: {
    invoiceId: { type: 'string' },
    amount:    { type: 'number', minimum: 0 },
  },
};

export default async function arRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new ArService(req.server.prisma);

  // ── Customers ─────────────────────────────────────────────────────────────

  // GET /ar/customers
  fastify.get('/customers', {
    schema: {
      tags: ['Finance - AR'],
      querystring: {
        type: 'object',
        properties: {
          search:   { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).listCustomers(req.user.companyId, req.query));
  });

  // GET /ar/customers/search
  fastify.get('/customers/search', {
    schema: {
      tags: ['Finance - AR'],
      querystring: { type: 'object', properties: { q: { type: 'string' } } },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: { q?: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).searchCustomers(req.user.companyId, req.query.q ?? ''));
  });

  // POST /ar/customers
  fastify.post('/customers', {
    schema: {
      tags: ['Finance - AR'],
      body: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(await svc(req).createCustomer(req.user.companyId, req.body));
  });

  // PUT /ar/customers/:id
  fastify.put('/customers/:id', {
    schema: {
      tags: ['Finance - AR'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          name:     { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).updateCustomer(req.params.id, req.user.companyId, req.body));
  });

  // ── AR Invoices ───────────────────────────────────────────────────────────

  // GET /ar/invoices
  fastify.get('/invoices', {
    schema: {
      tags: ['Finance - AR'],
      querystring: {
        type: 'object',
        properties: {
          status:     { type: 'string', enum: ['DRAFT', 'POSTED', 'PARTIAL', 'PAID', 'CANCELLED'] },
          customerId: { type: 'string' },
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

  // GET /ar/invoices/:id
  fastify.get('/invoices/:id', {
    schema: {
      tags: ['Finance - AR'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getInvoiceById(req.params.id, req.user.companyId));
  });

  // POST /ar/invoices
  fastify.post('/invoices', {
    schema: {
      tags: ['Finance - AR'],
      body: {
        type: 'object',
        required: ['customerId', 'invoiceDate', 'dueDate', 'amount'],
        properties: {
          customerId:       { type: 'string' },
          description:      { type: 'string' },
          invoiceDate:      { type: 'string', format: 'date' },
          dueDate:          { type: 'string', format: 'date' },
          amount:           { type: 'number', minimum: 0 },
          taxAmount:        { type: 'number', minimum: 0 },
          revenueAccountId: { type: 'string' },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const invoice = await svc(req).createInvoice(req.user.companyId, req.body, req.user.userId);
    return reply.code(201).send(invoice);
  });

  // ── AR Receipts ───────────────────────────────────────────────────────────

  // GET /ar/receipts
  fastify.get('/receipts', {
    schema: {
      tags: ['Finance - AR'],
      querystring: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          dateFrom:   { type: 'string', format: 'date' },
          dateTo:     { type: 'string', format: 'date' },
          page:       { type: 'integer', minimum: 1, default: 1 },
          limit:      { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).listReceipts(req.user.companyId, req.query));
  });

  // POST /ar/receipts
  fastify.post('/receipts', {
    schema: {
      tags: ['Finance - AR'],
      body: {
        type: 'object',
        required: ['customerId', 'receiptDate', 'amount', 'paymentMethod', 'allocations'],
        properties: {
          customerId:    { type: 'string' },
          receiptDate:   { type: 'string', format: 'date' },
          amount:        { type: 'number', minimum: 0 },
          paymentMethod: { type: 'string', enum: ['BANK_TRANSFER', 'CHEQUE', 'CASH'] },
          notes:         { type: 'string' },
          allocations:   { type: 'array', items: allocationSchema, minItems: 1 },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const receipt = await svc(req).createReceipt(req.user.companyId, req.body, req.user.userId);
    return reply.code(201).send(receipt);
  });
}
