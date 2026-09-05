import { FastifyInstance } from 'fastify';
import { SalesDashboardService } from '../../services/sales/SalesDashboardService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const VIEW = requirePermission('SALES', 'REPORTS', 'VIEW');

export default async function salesDashboardRoutes(fastify: FastifyInstance) {
  const svc = () => new SalesDashboardService(fastify.prisma);
  fastify.get('/kpis', { schema: { tags: ['Sales - Dashboard'] }, preHandler: [VIEW] }, async (req, reply) => reply.send(await svc().getKpis(req.user.companyId)));
}
