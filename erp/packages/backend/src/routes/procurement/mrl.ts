import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MrlService } from '../../services/procurement/MrlService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW: requirePermission('PROCUREMENT', 'MRL', 'VIEW'),
  CREATE: requirePermission('PROCUREMENT', 'MRL', 'CREATE'),
  EDIT: requirePermission('PROCUREMENT', 'MRL', 'EDIT'),
  APPROVE: requirePermission('PROCUREMENT', 'MRL', 'APPROVE'),
};

const lineSchema = {
  type: 'object',
  required: ['itemId', 'uomId', 'requestedQty'],
  properties: {
    itemId: { type: 'string' },
    uomId: { type: 'string' },
    requestedQty: { type: 'number', exclusiveMinimum: 0 },
    approxPrice: { type: 'number', minimum: 0, default: 0 },
    grade1: { type: 'string' },
    grade2: { type: 'string' },
  },
};

const listQuerySchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CLOSED'] },
    locationId: { type: 'string' },
    dateFrom: { type: 'string', format: 'date' },
    dateTo: { type: 'string', format: 'date' },
    createdBy: { type: 'string' },
    search: { type: 'string' },
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
  },
};

export default async function mrlRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new MrlService(req.server.prisma);

  // GET /mrl
  fastify.get('/', { schema: { tags: ['Procurement - MRL'], querystring: listQuerySchema }, preHandler: [PERM.VIEW] },
    async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
      const result = await svc(req).list({ companyId: req.user.companyId, ...req.query });
      return reply.send(result);
    }
  );

  // POST /mrl
  fastify.post('/', {
    schema: {
      tags: ['Procurement - MRL'],
      body: {
        type: 'object',
        required: ['locationId', 'chargeCodeId', 'docDate', 'deliveryDate', 'lines'],
        properties: {
          locationId: { type: 'string' },
          chargeCodeId: { type: 'string' },
          docDate: { type: 'string', format: 'date' },
          deliveryDate: { type: 'string', format: 'date' },
          remarks: { type: 'string' },
          lines: { type: 'array', items: lineSchema, minItems: 1 },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const result = await svc(req).create(
      { companyId: req.user.companyId, ...req.body },
      req.user.userId
    );
    return reply.code(201).send(result);
  });

  // GET /mrl/:id
  fastify.get('/:id', {
    schema: { tags: ['Procurement - MRL'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).getById(req.params.id, req.user.companyId);
    return reply.send(result);
  });

  // PUT /mrl/:id
  fastify.put('/:id', {
    schema: {
      tags: ['Procurement - MRL'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          chargeCodeId: { type: 'string' },
          deliveryDate: { type: 'string', format: 'date' },
          remarks: { type: 'string' },
          lines: { type: 'array', items: lineSchema, minItems: 1 },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const result = await svc(req).update(req.params.id, req.user.companyId, req.body, req.user.userId);
    return reply.send(result);
  });

  // POST /mrl/:id/submit
  fastify.post('/:id/submit', {
    schema: { tags: ['Procurement - MRL'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).submit(req.params.id, req.user.companyId, req.user.userId);
    return reply.send(result);
  });

  // POST /mrl/:id/approve
  fastify.post('/:id/approve', {
    schema: {
      tags: ['Procurement - MRL'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          comment: { type: 'string' },
          lineAdjustments: {
            type: 'array',
            items: {
              type: 'object',
              required: ['lineId', 'approvedQty'],
              properties: {
                lineId: { type: 'string' },
                approvedQty: { type: 'number', minimum: 0 },
              },
            },
          },
        },
      },
    },
    preHandler: [PERM.APPROVE],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: { comment?: string; lineAdjustments?: any[] } }>, reply: FastifyReply) => {
    const result = await svc(req).approve(
      req.params.id,
      req.user.companyId,
      req.user.userId,
      req.body.comment,
      req.body.lineAdjustments
    );
    return reply.send(result);
  });

  // POST /mrl/:id/reject
  fastify.post('/:id/reject', {
    schema: {
      tags: ['Procurement - MRL'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['reason'],
        properties: { reason: { type: 'string', minLength: 1 } },
      },
    },
    preHandler: [PERM.APPROVE],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: { reason: string } }>, reply: FastifyReply) => {
    const result = await svc(req).reject(req.params.id, req.user.companyId, req.user.userId, req.body.reason);
    return reply.send(result);
  });

  // POST /mrl/:id/convert-to-pr
  fastify.post('/:id/convert-to-pr', {
    schema: {
      tags: ['Procurement - MRL'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).convertToPrl(req.params.id, req.user.companyId, req.user.userId);
    return reply.code(201).send(result);
  });
}
