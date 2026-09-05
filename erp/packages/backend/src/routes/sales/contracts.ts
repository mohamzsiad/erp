import { FastifyInstance } from 'fastify';
import { SalesContractService } from '../../services/sales/SalesContractService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:    requirePermission('SALES', 'SALES_CONTRACT', 'VIEW'),
  CREATE:  requirePermission('SALES', 'SALES_CONTRACT', 'CREATE'),
  EDIT:    requirePermission('SALES', 'SALES_CONTRACT', 'EDIT'),
  APPROVE: requirePermission('SALES', 'SALES_CONTRACT', 'APPROVE'),
};
const boqLineSchema = {
  type: 'object', required: ['itemDescription', 'contractQty', 'rate'],
  properties: {
    section: { type: 'string', nullable: true }, subSection: { type: 'string', nullable: true }, itemDescription: { type: 'string' },
    uomId: { type: 'string', nullable: true }, contractQty: { type: 'number', minimum: 0 }, rate: { type: 'number', minimum: 0 },
  },
};
const bodyProps = {
  customerId: { type: 'string' }, projectRef: { type: 'string', nullable: true }, projectName: { type: 'string' },
  contractValue: { type: 'number', minimum: 0 }, startDate: { type: 'string', nullable: true }, endDate: { type: 'string', nullable: true },
  paymentTerms: { type: 'string', nullable: true }, costCenterId: { type: 'string', nullable: true }, boqLines: { type: 'array', items: boqLineSchema },
};
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export default async function contractRoutes(fastify: FastifyInstance) {
  const svc = () => new SalesContractService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; status?: string; customerId?: string; page?: number; limit?: number } }>('/', {
    schema: { tags: ['Sales - Contracts'], querystring: { type: 'object', properties: { search: { type: 'string' }, status: { type: 'string' }, customerId: { type: 'string' }, page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', { schema: { tags: ['Sales - Contracts'], params: idParam }, preHandler: [PERM.VIEW] }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Contracts'], body: { type: 'object', required: ['customerId', 'projectName'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId)));

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: { tags: ['Sales - Contracts'], params: idParam, body: { type: 'object', properties: bodyProps } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId)));

  fastify.post<{ Params: { id: string }; Body: { lines: any[] } }>('/:id/boq', {
    schema: { tags: ['Sales - Contracts'], params: idParam, body: { type: 'object', required: ['lines'], properties: { lines: { type: 'array', items: boqLineSchema } } } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().setBoq(req.params.id, req.user.companyId, req.body.lines, req.user.userId)));

  fastify.post<{ Params: { id: string }; Body: any }>('/:id/variations', {
    schema: {
      tags: ['Sales - Contracts'], params: idParam,
      body: { type: 'object', properties: {
        reason: { type: 'string' },
        adjustments: { type: 'array', items: { type: 'object', required: ['boqLineId', 'deltaQty'], properties: { boqLineId: { type: 'string' }, deltaQty: { type: 'number' } } } },
        newLines: { type: 'array', items: boqLineSchema },
      } },
    },
    preHandler: [PERM.APPROVE],
  }, async (req, reply) => reply.send(await svc().applyVariation(req.params.id, req.user.companyId, req.body as any, req.user.userId)));

  fastify.post<{ Params: { id: string }; Body: { status: string } }>('/:id/status', {
    schema: { tags: ['Sales - Contracts'], params: idParam, body: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED'] } } } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().setStatus(req.params.id, req.user.companyId, req.body.status as any, req.user.userId)));
}
