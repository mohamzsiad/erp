import { FastifyInstance } from 'fastify';
import { SalesEnquiryService } from '../../services/sales/SalesEnquiryService.js';
import { SalesQuotationService } from '../../services/sales/SalesQuotationService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('SALES', 'SALES_ENQUIRY', 'VIEW'),
  CREATE: requirePermission('SALES', 'SALES_ENQUIRY', 'CREATE'),
  EDIT:   requirePermission('SALES', 'SALES_ENQUIRY', 'EDIT'),
};

const lineSchema = {
  type: 'object', required: ['itemId', 'uomId', 'qty'],
  properties: {
    itemId: { type: 'string' }, description: { type: 'string', nullable: true }, uomId: { type: 'string' },
    qty: { type: 'number', minimum: 0 }, targetPrice: { type: 'number', nullable: true },
  },
};
const bodyProps = {
  customerId: { type: 'string', nullable: true }, prospectName: { type: 'string', nullable: true },
  enquiryDate: { type: 'string' }, requiredByDate: { type: 'string', nullable: true },
  salespersonId: { type: 'string', nullable: true }, source: { type: 'string', nullable: true },
  notes: { type: 'string', nullable: true }, lines: { type: 'array', items: lineSchema },
};

export default async function enquiryRoutes(fastify: FastifyInstance) {
  const svc = () => new SalesEnquiryService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; status?: string; customerId?: string; page?: number; limit?: number } }>('/', {
    schema: { tags: ['Sales - Enquiries'], querystring: { type: 'object', properties: {
      search: { type: 'string' }, status: { type: 'string' }, customerId: { type: 'string' },
      page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Sales - Enquiries'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Enquiries'], body: { type: 'object', required: ['enquiryDate'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => {
    const r = await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId);
    return reply.code(201).send(r);
  });

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: { tags: ['Sales - Enquiries'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, body: { type: 'object', properties: bodyProps } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId)));

  fastify.post<{ Params: { id: string }; Body: { status: string; lostReason?: string } }>('/:id/status', {
    schema: { tags: ['Sales - Enquiries'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['OPEN', 'QUOTED', 'WON', 'LOST', 'CLOSED'] }, lostReason: { type: 'string' } } } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().setStatus(req.params.id, req.user.companyId, req.body.status as any, req.user.userId, req.body.lostReason)));

  // Convert enquiry → quotation
  fastify.post<{ Params: { id: string } }>('/:id/convert', {
    schema: { tags: ['Sales - Enquiries'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => {
    const quotation = await new SalesQuotationService(fastify.prisma).createFromEnquiry(req.params.id, req.user.companyId, req.user.userId);
    return reply.code(201).send(quotation);
  });
}
