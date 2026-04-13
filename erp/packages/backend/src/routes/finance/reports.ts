import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReportService } from '../../services/finance/ReportService.js';
import { BudgetService } from '../../services/finance/BudgetService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM_VIEW = requirePermission('FINANCE', 'REPORT', 'VIEW');

export default async function reportRoutes(fastify: FastifyInstance) {
  const rptSvc = (req: FastifyRequest) => new ReportService(req.server.prisma);
  const budSvc = (req: FastifyRequest) => new BudgetService(req.server.prisma);

  // GET /reports/trial-balance
  fastify.get('/trial-balance', {
    schema: {
      tags: ['Finance - Reports'],
      querystring: {
        type: 'object',
        properties: {
          dateFrom:    { type: 'string', format: 'date' },
          dateTo:      { type: 'string', format: 'date' },
          accountType: { type: 'string', enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] },
        },
      },
    },
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await rptSvc(req).trialBalance(req.user.companyId, req.query));
  });

  // GET /reports/pnl
  fastify.get('/pnl', {
    schema: {
      tags: ['Finance - Reports'],
      querystring: {
        type: 'object',
        required: ['dateFrom', 'dateTo'],
        properties: {
          dateFrom:     { type: 'string', format: 'date' },
          dateTo:       { type: 'string', format: 'date' },
          costCenterId: { type: 'string' },
        },
      },
    },
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await rptSvc(req).profitAndLoss(req.user.companyId, req.query));
  });

  // GET /reports/balance-sheet
  fastify.get('/balance-sheet', {
    schema: {
      tags: ['Finance - Reports'],
      querystring: {
        type: 'object',
        required: ['asAt'],
        properties: {
          asAt: { type: 'string', format: 'date' },
        },
      },
    },
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await rptSvc(req).balanceSheet(req.user.companyId, req.query));
  });

  // GET /reports/ap-aging  (supplier aging)
  fastify.get('/ap-aging', {
    schema: {
      tags: ['Finance - Reports'],
      querystring: {
        type: 'object',
        properties: {
          supplierId: { type: 'string' },
          asAt:       { type: 'string', format: 'date' },
        },
      },
    },
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await rptSvc(req).supplierAging(req.user.companyId, req.query));
  });

  // GET /reports/ar-aging  (customer aging)
  fastify.get('/ar-aging', {
    schema: {
      tags: ['Finance - Reports'],
      querystring: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          asAt:       { type: 'string', format: 'date' },
        },
      },
    },
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await rptSvc(req).customerAging(req.user.companyId, req.query));
  });

  // GET /reports/budget-vs-actual
  fastify.get('/budget-vs-actual', {
    schema: {
      tags: ['Finance - Reports'],
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
    preHandler: [PERM_VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await budSvc(req).vsActual(req.user.companyId, {
      fiscalYear:   Number(req.query.fiscalYear),
      periodFrom:   req.query.periodFrom   ? Number(req.query.periodFrom)   : undefined,
      periodTo:     req.query.periodTo     ? Number(req.query.periodTo)     : undefined,
      costCenterId: req.query.costCenterId ?? undefined,
    }));
  });
}
