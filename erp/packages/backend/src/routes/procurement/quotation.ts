import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { QuotationService } from '../../services/procurement/QuotationService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM_VIEW = requirePermission('PROCUREMENT', 'PRL', 'VIEW');
const PERM_CREATE = requirePermission('PROCUREMENT', 'PRL', 'CREATE');
const PERM_APPROVE = requirePermission('PROCUREMENT', 'PO', 'APPROVE');

export default async function quotationRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new QuotationService(req.server.prisma);

  // GET /quotation
  fastify.get('/', {
    schema: {
      tags: ['Procurement - Quotation'],
      querystring: {
        type: 'object',
        properties: {
          supplierId: { type: 'string' },
          enquiryId: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    const result = await svc(req).list(req.user.companyId, req.query);
    return reply.send(result);
  });

  // GET /quotation/compare/:enquiryId
  fastify.get('/compare/:enquiryId', {
    schema: {
      tags: ['Procurement - Quotation'],
      params: { type: 'object', properties: { enquiryId: { type: 'string' } }, required: ['enquiryId'] },
    },
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Params: { enquiryId: string } }>, reply: FastifyReply) => {
    const result = await svc(req).compare(req.params.enquiryId, req.user.companyId);
    return reply.send(result);
  });

  // GET /quotation/:id
  fastify.get('/:id', {
    schema: { tags: ['Procurement - Quotation'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).getById(req.params.id, req.user.companyId);
    return reply.send(result);
  });

  // POST /quotation
  fastify.post('/', {
    schema: {
      tags: ['Procurement - Quotation'],
      body: {
        type: 'object',
        required: ['supplierId', 'enquiryId', 'validityDate', 'currencyId', 'totalAmount'],
        properties: {
          supplierId: { type: 'string' },
          enquiryId: { type: 'string' },
          validityDate: { type: 'string', format: 'date' },
          currencyId: { type: 'string' },
          paymentTerms: { type: 'string' },
          totalAmount: { type: 'number', minimum: 0 },
        },
      },
    },
    preHandler: [PERM_CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const result = await svc(req).create({ companyId: req.user.companyId, ...req.body }, req.user.userId);
    return reply.code(201).send(result);
  });

  // POST /quotation/:id/award
  fastify.post('/:id/award', {
    schema: {
      tags: ['Procurement - Quotation'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM_APPROVE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).award(req.params.id, req.user.companyId, req.user.userId);
    return reply.send(result);
  });
}
