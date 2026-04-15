import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DashboardService } from '../../services/DashboardService.js';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new DashboardService(req.server.prisma);

  // GET /dashboard/kpis — all KPIs in one call (Promise.all)
  fastify.get('/kpis', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Get all dashboard KPIs in one call',
      response: {
        200: {
          type: 'object',
          properties: {
            kpis: { type: 'object' },
            workSummary: { type: 'object' },
            charts: { type: 'object' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const data = await svc(req).getKpis(req.user.companyId);
    return reply.send(data);
  });

  // GET /dashboard/workflow-tasks — pending approval tasks for My Work tab
  fastify.get('/workflow-tasks', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Get pending workflow tasks for the current user',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const tasks = await svc(req).getWorkflowTasks(req.user.userId, req.user.companyId);
    return reply.send({ tasks });
  });
}
