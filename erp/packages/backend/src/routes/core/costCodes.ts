import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CostCodeService } from '../../services/finance/CostCodeService.js';

export default async function costCodeRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new CostCodeService(req.server.prisma);

  // GET /cost-codes?search=&limit=&isActive=&costCenterId=
  fastify.get('/', {
    schema: {
      tags: ['Core - Cost Codes'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          limit: { type: 'integer' },
          isActive: { type: 'boolean' },
          costCenterId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Querystring: { search?: string; limit?: number; isActive?: boolean; costCenterId?: string } }>, reply: FastifyReply) => {
    const { search, isActive, costCenterId } = req.query;
    const results = await svc(req).list(req.user.companyId, { search, isActive, costCenterId });
    return reply.send(results);
  });
}
