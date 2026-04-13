import { FastifyInstance } from 'fastify';
import accountRoutes     from './accounts.js';
import costCenterRoutes  from './costCenters.js';
import journalRoutes     from './journals.js';
import apRoutes          from './ap.js';
import arRoutes          from './ar.js';
import budgetRoutes      from './budgets.js';
import periodRoutes      from './periods.js';
import accountMappingRoutes from './accountMappings.js';
import reportRoutes      from './reports.js';

export default async function financeRoutes(fastify: FastifyInstance) {
  await fastify.register(accountRoutes,      { prefix: '/accounts' });
  await fastify.register(costCenterRoutes,   { prefix: '/cost-centers' });
  await fastify.register(journalRoutes,      { prefix: '/journals' });
  await fastify.register(apRoutes,           { prefix: '/ap' });
  await fastify.register(arRoutes,           { prefix: '/ar' });
  await fastify.register(budgetRoutes,       { prefix: '/budgets' });
  await fastify.register(periodRoutes,       { prefix: '/periods' });
  await fastify.register(accountMappingRoutes, { prefix: '/account-mappings' });
  await fastify.register(reportRoutes,       { prefix: '/reports' });

  // ── Charge codes search (alias used by MRL form) ──────────────────────────
  // Route: GET /finance/charge-codes/search?q=...
  // Returns active cost codes matching the query
  fastify.get('/charge-codes/search', {
    schema: {
      tags: ['Finance'],
      querystring: {
        type: 'object',
        properties: { q: { type: 'string' } },
      },
    },
  }, async (req: any, reply: any) => {
    const q: string = req.query.q ?? '';
    const results = await req.server.prisma.costCode.findMany({
      where: {
        companyId: req.user.companyId,
        isActive: true,
        ...(q && {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      take: 20,
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, costCenterId: true },
    });
    return reply.send(results);
  });
}
