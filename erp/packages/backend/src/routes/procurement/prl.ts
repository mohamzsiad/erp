import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrlService } from '../../services/procurement/PrlService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW: requirePermission('PROCUREMENT', 'PRL', 'VIEW'),
  CREATE: requirePermission('PROCUREMENT', 'PRL', 'CREATE'),
  EDIT: requirePermission('PROCUREMENT', 'PRL', 'EDIT'),
  APPROVE: requirePermission('PROCUREMENT', 'PRL', 'APPROVE'),
};

const lineSchema = {
  type: 'object',
  required: ['itemId', 'uomId', 'chargeCodeId', 'requestedQty'],
  properties: {
    itemId: { type: 'string' },
    uomId: { type: 'string' },
    chargeCodeId: { type: 'string' },
    requestedQty: { type: 'number', exclusiveMinimum: 0 },
    approxPrice: { type: 'number', minimum: 0, default: 0 },
    grade1: { type: 'string' },
    grade2: { type: 'string' },
  },
};

export default async function prlRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new PrlService(req.server.prisma);

  // GET /prl
  fastify.get('/', {
    schema: {
      tags: ['Procurement - PRL'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          locationId: { type: 'string' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          createdBy: { type: 'string' },
          search: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    const result = await svc(req).list({ companyId: req.user.companyId, ...req.query });
    return reply.send(result);
  });

  // POST /prl
  fastify.post('/', {
    schema: {
      tags: ['Procurement - PRL'],
      body: {
        type: 'object',
        required: ['locationId', 'chargeCodeId', 'docDate', 'deliveryDate', 'lines'],
        properties: {
          locationId: { type: 'string' },
          chargeCodeId: { type: 'string' },
          docDate: { type: 'string', format: 'date' },
          deliveryDate: { type: 'string', format: 'date' },
          remarks: { type: 'string' },
          mrlId: { type: 'string' },
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

  // GET /prl/:id
  fastify.get('/:id', {
    schema: { tags: ['Procurement - PRL'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).getById(req.params.id, req.user.companyId);
    return reply.send(result);
  });

  // GET /prl/:id/status
  fastify.get('/:id/status', {
    schema: { tags: ['Procurement - PRL'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).getFulfilmentStatus(req.params.id, req.user.companyId);
    return reply.send(result);
  });

  // POST /prl/:id/short-close
  fastify.post('/:id/short-close', {
    schema: {
      tags: ['Procurement - PRL'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['lineIds'],
        properties: { lineIds: { type: 'array', items: { type: 'string' }, minItems: 1 } },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: { lineIds: string[] } }>, reply: FastifyReply) => {
    const result = await svc(req).shortClose(
      req.params.id,
      req.user.companyId,
      req.body.lineIds,
      req.user.userId
    );
    return reply.send(result);
  });

  // POST /prl/:id/create-enquiry
  fastify.post('/:id/create-enquiry', {
    schema: {
      tags: ['Procurement - PRL'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['supplierIds'],
        properties: {
          supplierIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
          lineIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: { supplierIds: string[]; lineIds?: string[] } }>, reply: FastifyReply) => {
    const result = await svc(req).createEnquiry(
      req.params.id,
      req.user.companyId,
      req.user.userId,
      req.body.supplierIds,
      req.body.lineIds
    );
    return reply.code(201).send(result);
  });
}
