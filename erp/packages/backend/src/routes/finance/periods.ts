import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PeriodService } from '../../services/finance/PeriodService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:  requirePermission('FINANCE', 'PERIOD', 'VIEW'),
  CLOSE: requirePermission('FINANCE', 'PERIOD', 'EDIT'),
};

export default async function periodRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new PeriodService(req.server.prisma);

  // GET /periods
  fastify.get('/', {
    schema: { tags: ['Finance - Periods'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).listPeriods(req.user.companyId));
  });

  // POST /periods/close
  fastify.post('/close', {
    schema: {
      tags: ['Finance - Periods'],
      body: {
        type: 'object',
        required: ['periodYear', 'periodMonth'],
        properties: {
          periodYear:  { type: 'integer' },
          periodMonth: { type: 'integer', minimum: 1, maximum: 12 },
        },
      },
    },
    preHandler: [PERM.CLOSE],
  }, async (req: FastifyRequest<{ Body: { periodYear: number; periodMonth: number } }>, reply: FastifyReply) => {
    return reply.send(
      await svc(req).closePeriod(req.user.companyId, req.body.periodYear, req.body.periodMonth, req.user.userId)
    );
  });

  // POST /periods/reopen
  fastify.post('/reopen', {
    schema: {
      tags: ['Finance - Periods'],
      body: {
        type: 'object',
        required: ['periodYear', 'periodMonth'],
        properties: {
          periodYear:  { type: 'integer' },
          periodMonth: { type: 'integer', minimum: 1, maximum: 12 },
        },
      },
    },
    preHandler: [PERM.CLOSE],
  }, async (req: FastifyRequest<{ Body: { periodYear: number; periodMonth: number } }>, reply: FastifyReply) => {
    return reply.send(
      await svc(req).reopenPeriod(req.user.companyId, req.body.periodYear, req.body.periodMonth, req.user.userId)
    );
  });
}
