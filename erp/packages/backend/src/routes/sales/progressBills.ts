import { FastifyInstance } from 'fastify';
import { ProgressBillService } from '../../services/sales/ProgressBillService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:    requirePermission('SALES', 'PROGRESS_BILL', 'VIEW'),
  CREATE:  requirePermission('SALES', 'PROGRESS_BILL', 'CREATE'),
  EDIT:    requirePermission('SALES', 'PROGRESS_BILL', 'EDIT'),
  CERTIFY: requirePermission('SALES', 'PROGRESS_BILL', 'APPROVE'),
};
const lineSchema = { type: 'object', required: ['boqLineId', 'cumQty'], properties: { boqLineId: { type: 'string' }, cumQty: { type: 'number', minimum: 0 } } };
const bodyProps = { contractId: { type: 'string' }, period: { type: 'string' }, billDate: { type: 'string' }, lines: { type: 'array', items: lineSchema } };
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export default async function progressBillRoutes(fastify: FastifyInstance) {
  const svc = () => new ProgressBillService(fastify.prisma);

  // Form data: BOQ lines + previous cumulative for a contract.
  fastify.get<{ Params: { contractId: string } }>('/prepare/:contractId', {
    schema: { tags: ['Sales - Progress Bills'], params: { type: 'object', required: ['contractId'], properties: { contractId: { type: 'string' } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().prepare(req.params.contractId, req.user.companyId)));

  fastify.get<{ Querystring: { search?: string; status?: string; contractId?: string; page?: number; limit?: number } }>('/', {
    schema: { tags: ['Sales - Progress Bills'], querystring: { type: 'object', properties: { search: { type: 'string' }, status: { type: 'string' }, contractId: { type: 'string' }, page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', { schema: { tags: ['Sales - Progress Bills'], params: idParam }, preHandler: [PERM.VIEW] }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));
  fastify.get<{ Params: { id: string } }>('/:id/print', { schema: { tags: ['Sales - Progress Bills'], params: idParam }, preHandler: [PERM.VIEW] }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Progress Bills'], body: { type: 'object', required: ['contractId', 'period', 'billDate', 'lines'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId)));

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: { tags: ['Sales - Progress Bills'], params: idParam, body: { type: 'object', properties: { period: { type: 'string' }, billDate: { type: 'string' }, lines: { type: 'array', items: lineSchema } } } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/submit', { schema: { tags: ['Sales - Progress Bills'], params: idParam }, preHandler: [PERM.EDIT] }, async (req, reply) => reply.send(await svc().submit(req.params.id, req.user.companyId, req.user.userId)));
  fastify.post<{ Params: { id: string } }>('/:id/certify', { schema: { tags: ['Sales - Progress Bills'], params: idParam }, preHandler: [PERM.CERTIFY] }, async (req, reply) => reply.send(await svc().certify(req.params.id, req.user.companyId, req.user.userId)));
  fastify.post<{ Params: { id: string } }>('/:id/post', { schema: { tags: ['Sales - Progress Bills'], params: idParam }, preHandler: [PERM.EDIT] }, async (req, reply) => reply.send(await svc().post(req.params.id, req.user.companyId, req.user.userId)));
}
