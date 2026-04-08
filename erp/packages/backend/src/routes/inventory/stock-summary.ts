import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StockSummaryService } from '../../services/inventory/StockSummaryService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW: requirePermission('INVENTORY', 'STOCK_SUMMARY', 'VIEW'),
};

export default async function stockSummaryRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new StockSummaryService(req.server.prisma);

  // GET /stock-summary
  fastify.get('/', {
    schema: { tags: ['Inventory - Stock Summary'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).getOverallSummary(req.user.companyId));
  });

  // GET /stock-summary/dead-stock
  fastify.get('/dead-stock', {
    schema: {
      tags: ['Inventory - Stock Summary'],
      querystring: {
        type: 'object',
        properties: {
          noMovementDays: { type: 'integer', minimum: 1, default: 90 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(
      await svc(req).getDeadStock(req.user.companyId, req.query.noMovementDays),
    );
  });

  // GET /stock-summary/obsolete-stock
  fastify.get('/obsolete-stock', {
    schema: { tags: ['Inventory - Stock Summary'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).getObsoleteStock(req.user.companyId));
  });

  // GET /stock-summary/pending-documents
  fastify.get('/pending-documents', {
    schema: { tags: ['Inventory - Stock Summary'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).getPendingDocuments(req.user.companyId));
  });

  // GET /stock-summary/reorder-alerts
  fastify.get('/reorder-alerts', {
    schema: { tags: ['Inventory - Stock Summary'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).getReorderAlerts(req.user.companyId));
  });

  // GET /stock-summary/aging
  fastify.get('/aging', {
    schema: { tags: ['Inventory - Stock Summary'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).getStockAging(req.user.companyId));
  });
}
