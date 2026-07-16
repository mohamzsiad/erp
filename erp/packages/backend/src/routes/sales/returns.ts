import { FastifyInstance } from 'fastify';
import { SalesReturnService } from '../../services/sales/SalesReturnService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('SALES', 'SALES_RETURN', 'VIEW'),
  CREATE: requirePermission('SALES', 'SALES_RETURN', 'CREATE'),
  EDIT:   requirePermission('SALES', 'SALES_RETURN', 'EDIT'),
};
const lineSchema = { type: 'object', required: ['itemId', 'uomId', 'qty'], properties: { itemId: { type: 'string' }, uomId: { type: 'string' }, qty: { type: 'number', minimum: 0 } } };
const bodyProps = {
  salesInvoiceId: { type: 'string', nullable: true }, deliveryNoteId: { type: 'string', nullable: true }, customerId: { type: 'string', nullable: true },
  returnDate: { type: 'string' }, reason: { type: 'string', nullable: true }, lines: { type: 'array', items: lineSchema },
};
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export default async function returnRoutes(fastify: FastifyInstance) {
  const svc = () => new SalesReturnService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; status?: string; page?: number; limit?: number } }>('/', {
    schema: { tags: ['Sales - Returns'], querystring: { type: 'object', properties: { search: { type: 'string' }, status: { type: 'string' }, page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', { schema: { tags: ['Sales - Returns'], params: idParam }, preHandler: [PERM.VIEW] }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Returns'], body: { type: 'object', required: ['returnDate', 'lines'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/approve', { schema: { tags: ['Sales - Returns'], params: idParam }, preHandler: [PERM.EDIT] }, async (req, reply) => reply.send(await svc().approve(req.params.id, req.user.companyId, req.user.userId)));
  fastify.post<{ Params: { id: string } }>('/:id/receive', { schema: { tags: ['Sales - Returns'], params: idParam }, preHandler: [PERM.EDIT] }, async (req, reply) => reply.send(await svc().receive(req.params.id, req.user.companyId, req.user.userId)));
  fastify.post<{ Params: { id: string } }>('/:id/close', { schema: { tags: ['Sales - Returns'], params: idParam }, preHandler: [PERM.EDIT] }, async (req, reply) => reply.send(await svc().close(req.params.id, req.user.companyId, req.user.userId)));
}
