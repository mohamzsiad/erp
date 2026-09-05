import { FastifyInstance } from 'fastify';
import { SalesmanService } from '../../services/sales/SalesmanService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('SALES', 'SALESMAN', 'VIEW'),
  CREATE: requirePermission('SALES', 'SALESMAN', 'CREATE'),
  EDIT:   requirePermission('SALES', 'SALESMAN', 'EDIT'),
  DELETE: requirePermission('SALES', 'SALESMAN', 'DELETE'),
};

const bodyProps = {
  code: { type: 'string', maxLength: 20 },
  name: { type: 'string', maxLength: 200 },
  shortName: { type: 'string', nullable: true },
  type: { type: 'string', enum: ['SALESMAN', 'SUPERVISOR', 'VAN_SALESMAN', 'MANAGER'] },
  minMarkupPct: { type: 'number', minimum: 0 },
  maxVariancePct: { type: 'number', minimum: 0 },
  locationId: { type: 'string', nullable: true },
  contactNumber: { type: 'string', nullable: true },
  email: { type: 'string', nullable: true },
  userId: { type: 'string', nullable: true },
  isActive: { type: 'boolean' },
};
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export default async function salesmanRoutes(fastify: FastifyInstance) {
  const svc = () => new SalesmanService(fastify.prisma);

  fastify.get<{ Querystring: { q: string } }>('/search', {
    schema: { tags: ['Sales - Salesmen'], querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string' } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().search(req.user.companyId, req.query.q)));

  fastify.get<{ Querystring: { search?: string; isActive?: boolean } }>('/', {
    schema: { tags: ['Sales - Salesmen'], querystring: { type: 'object', properties: { search: { type: 'string' }, isActive: { type: 'boolean' } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Sales - Salesmen'], params: idParam }, preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Salesmen'], body: { type: 'object', required: ['name'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId)));

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: { tags: ['Sales - Salesmen'], params: idParam, body: { type: 'object', properties: bodyProps } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/toggle-active', {
    schema: { tags: ['Sales - Salesmen'], params: idParam }, preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().toggleActive(req.params.id, req.user.companyId, req.user.userId)));

  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Sales - Salesmen'], params: idParam }, preHandler: [PERM.DELETE],
  }, async (req, reply) => reply.send(await svc().remove(req.params.id, req.user.companyId, req.user.userId)));
}
