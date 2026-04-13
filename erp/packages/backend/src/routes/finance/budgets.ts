import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BudgetService } from '../../services/finance/BudgetService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('FINANCE', 'BUDGET', 'VIEW'),
  CREATE: requirePermission('FINANCE', 'BUDGET', 'CREATE'),
  EDIT:   requirePermission('FINANCE', 'BUDGET', 'EDIT'),
};

export default async function budgetRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new BudgetService(req.server.prisma);

  // GET /budgets
  fastify.get('/', {
    schema: {
      tags: ['Finance - Budget'],
      querystring: {
        type: 'object',
        properties: {
          fiscalYear:   { type: 'integer' },
          accountId:    { type: 'string' },
          costCenterId: { type: 'string' },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    const params: any = {};
    if (req.query.fiscalYear)   params.fiscalYear   = Number(req.query.fiscalYear);
    if (req.query.accountId)    params.accountId    = req.query.accountId;
    if (req.query.costCenterId) params.costCenterId = req.query.costCenterId;
    return reply.send(await svc(req).list(req.user.companyId, params));
  });

  // GET /budgets/vs-actual
  fastify.get('/vs-actual', {
    schema: {
      tags: ['Finance - Budget'],
      querystring: {
        type: 'object',
        required: ['fiscalYear'],
        properties: {
          fiscalYear:   { type: 'integer' },
          periodFrom:   { type: 'integer', minimum: 1, maximum: 12 },
          periodTo:     { type: 'integer', minimum: 1, maximum: 12 },
          costCenterId: { type: 'string' },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).vsActual(req.user.companyId, {
      fiscalYear:   Number(req.query.fiscalYear),
      periodFrom:   req.query.periodFrom   ? Number(req.query.periodFrom)   : undefined,
      periodTo:     req.query.periodTo     ? Number(req.query.periodTo)     : undefined,
      costCenterId: req.query.costCenterId ?? undefined,
    }));
  });

  // GET /budgets/check
  fastify.get('/check', {
    schema: {
      tags: ['Finance - Budget'],
      querystring: {
        type: 'object',
        required: ['accountId', 'amount'],
        properties: {
          accountId:    { type: 'string' },
          costCenterId: { type: 'string' },
          amount:       { type: 'number', minimum: 0 },
          periodYear:   { type: 'integer' },
          periodMonth:  { type: 'integer', minimum: 1, maximum: 12 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).check(req.user.companyId, {
      accountId:    req.query.accountId,
      costCenterId: req.query.costCenterId,
      amount:       Number(req.query.amount),
      periodYear:   req.query.periodYear  ? Number(req.query.periodYear)  : undefined,
      periodMonth:  req.query.periodMonth ? Number(req.query.periodMonth) : undefined,
    }));
  });

  // POST /budgets
  fastify.post('/', {
    schema: {
      tags: ['Finance - Budget'],
      body: {
        type: 'object',
        required: ['fiscalYear', 'accountId', 'annualAmount'],
        properties: {
          fiscalYear:   { type: 'integer' },
          accountId:    { type: 'string' },
          costCenterId: { type: 'string' },
          annualAmount: { type: 'number', minimum: 0 },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(await svc(req).create(req.user.companyId, req.body));
  });

  // POST /budgets/:id/phase
  fastify.post('/:id/phase', {
    schema: {
      tags: ['Finance - Budget'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['method'],
        properties: {
          method:  { type: 'string', enum: ['EQUAL', 'MANUAL'] },
          amounts: { type: 'object', additionalProperties: { type: 'number' } },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).phaseDistribution(req.params.id, req.user.companyId, req.body));
  });
}
