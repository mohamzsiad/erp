import { FastifyInstance } from 'fastify';
import { PaymentTermService } from '../../services/sales/PaymentTermService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('SALES', 'PAYMENT_TERM', 'VIEW'),
  CREATE: requirePermission('SALES', 'PAYMENT_TERM', 'CREATE'),
  EDIT:   requirePermission('SALES', 'PAYMENT_TERM', 'EDIT'),
  DELETE: requirePermission('SALES', 'PAYMENT_TERM', 'DELETE'),
};

const lineSchema = {
  type: 'object',
  required: ['paymentPct'],
  properties: {
    paymentPct: { type: 'number', minimum: 0, maximum: 100 },
    addMonths: { type: 'integer', minimum: 0 },
    creditDays: { type: 'integer', minimum: 0 },
    cashDiscountDays: { type: 'integer', nullable: true },
    cashDiscountPct: { type: 'number', nullable: true },
    isActive: { type: 'boolean' },
  },
};

const bodyProps = {
  code: { type: 'string', maxLength: 20 },
  name: { type: 'string', maxLength: 150 },
  shortName: { type: 'string', nullable: true },
  paymentMode: { type: 'string', enum: ['NORMAL', 'ADVANCE', 'CASH_ON_DELIVERY', 'CREDIT'] },
  dueDateBasis: { type: 'string', enum: ['DOCUMENT_DATE', 'DELIVERY_DATE', 'MONTH_END', 'INVOICE_DATE'] },
  dueDateAfterAdvance: { type: 'boolean' },
  creditDays: { type: 'integer', minimum: 0 },
  isActive: { type: 'boolean' },
  lines: { type: 'array', items: lineSchema },
};
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export default async function paymentTermRoutes(fastify: FastifyInstance) {
  const svc = () => new PaymentTermService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; isActive?: boolean } }>('/', {
    schema: { tags: ['Sales - Payment Terms'], querystring: { type: 'object', properties: { search: { type: 'string' }, isActive: { type: 'boolean' } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Sales - Payment Terms'], params: idParam }, preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Payment Terms'], body: { type: 'object', required: ['name'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId)));

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: { tags: ['Sales - Payment Terms'], params: idParam, body: { type: 'object', properties: bodyProps } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/toggle-active', {
    schema: { tags: ['Sales - Payment Terms'], params: idParam }, preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().toggleActive(req.params.id, req.user.companyId, req.user.userId)));

  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Sales - Payment Terms'], params: idParam }, preHandler: [PERM.DELETE],
  }, async (req, reply) => reply.send(await svc().remove(req.params.id, req.user.companyId, req.user.userId)));
}
