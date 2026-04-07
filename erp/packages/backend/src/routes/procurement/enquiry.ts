import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EnquiryService } from '../../services/procurement/EnquiryService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM_VIEW = requirePermission('PROCUREMENT', 'PRL', 'VIEW');
const PERM_CREATE = requirePermission('PROCUREMENT', 'PRL', 'CREATE');

export default async function enquiryRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new EnquiryService(req.server.prisma);

  // GET /enquiry
  fastify.get('/', {
    schema: {
      tags: ['Procurement - Enquiry'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Querystring: { status?: string; page?: number; limit?: number } }>, reply: FastifyReply) => {
    const result = await svc(req).list(req.user.companyId, req.query);
    return reply.send(result);
  });

  // GET /enquiry/:id
  fastify.get('/:id', {
    schema: { tags: ['Procurement - Enquiry'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).getById(req.params.id, req.user.companyId);
    return reply.send(result);
  });

  // POST /enquiry
  fastify.post('/', {
    schema: {
      tags: ['Procurement - Enquiry'],
      body: {
        type: 'object',
        required: ['supplierIds'],
        properties: {
          prlId: { type: 'string' },
          supplierIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
          remarks: { type: 'string' },
        },
      },
    },
    preHandler: [PERM_CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const result = await svc(req).create({ companyId: req.user.companyId, ...req.body }, req.user.userId);
    return reply.code(201).send(result);
  });

  // POST /enquiry/:id/send
  fastify.post('/:id/send', {
    schema: { tags: ['Procurement - Enquiry'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM_CREATE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).send(req.params.id, req.user.companyId, req.user.userId);
    return reply.send(result);
  });

  // POST /enquiry/:id/close
  fastify.post('/:id/close', {
    schema: { tags: ['Procurement - Enquiry'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM_CREATE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).close(req.params.id, req.user.companyId, req.user.userId);
    return reply.send(result);
  });
}
