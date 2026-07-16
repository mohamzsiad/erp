import { FastifyInstance } from 'fastify';
import { CreditNoteService } from '../../services/sales/CreditNoteService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('SALES', 'CREDIT_NOTE', 'VIEW'),
  CREATE: requirePermission('SALES', 'CREDIT_NOTE', 'CREATE'),
  EDIT:   requirePermission('SALES', 'CREDIT_NOTE', 'EDIT'),
  APPROVE: requirePermission('SALES', 'CREDIT_NOTE', 'APPROVE'),
};
const lineSchema = {
  type: 'object', required: ['itemId', 'uomId', 'qty', 'unitPrice'],
  properties: { itemId: { type: 'string' }, description: { type: 'string', nullable: true }, uomId: { type: 'string' }, qty: { type: 'number', minimum: 0 }, unitPrice: { type: 'number', minimum: 0 }, discountPct: { type: 'number' }, taxCodeId: { type: 'string', nullable: true } },
};
const bodyProps = {
  customerId: { type: 'string' }, salesReturnId: { type: 'string', nullable: true }, creditDate: { type: 'string' }, reason: { type: 'string', nullable: true }, lines: { type: 'array', items: lineSchema },
};
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export default async function creditNoteRoutes(fastify: FastifyInstance) {
  const svc = () => new CreditNoteService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; status?: string; customerId?: string; page?: number; limit?: number } }>('/', {
    schema: { tags: ['Sales - Credit Notes'], querystring: { type: 'object', properties: { search: { type: 'string' }, status: { type: 'string' }, customerId: { type: 'string' }, page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', { schema: { tags: ['Sales - Credit Notes'], params: idParam }, preHandler: [PERM.VIEW] }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));
  fastify.get<{ Params: { id: string } }>('/:id/print', { schema: { tags: ['Sales - Credit Notes'], params: idParam }, preHandler: [PERM.VIEW] }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Credit Notes'], body: { type: 'object', required: ['customerId', 'creditDate', 'lines'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId)));

  fastify.post<{ Params: { returnId: string } }>('/from-return/:returnId', {
    schema: { tags: ['Sales - Credit Notes'], params: { type: 'object', required: ['returnId'], properties: { returnId: { type: 'string' } } } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().createFromReturn(req.params.returnId, req.user.companyId, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/approve', { schema: { tags: ['Sales - Credit Notes'], params: idParam }, preHandler: [PERM.APPROVE] }, async (req, reply) => reply.send(await svc().approve(req.params.id, req.user.companyId, req.user.userId)));
  fastify.post<{ Params: { id: string } }>('/:id/post', { schema: { tags: ['Sales - Credit Notes'], params: idParam }, preHandler: [PERM.EDIT] }, async (req, reply) => reply.send(await svc().post(req.params.id, req.user.companyId, req.user.userId)));
  fastify.post<{ Params: { id: string } }>('/:id/cancel', { schema: { tags: ['Sales - Credit Notes'], params: idParam }, preHandler: [PERM.EDIT] }, async (req, reply) => reply.send(await svc().cancel(req.params.id, req.user.companyId, req.user.userId)));
}
