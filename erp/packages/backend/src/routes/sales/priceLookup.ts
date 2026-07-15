import { FastifyInstance } from 'fastify';
import { PriceResolutionService } from '../../services/sales/PriceResolutionService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const VIEW = requirePermission('SALES', 'PRICE_LIST', 'VIEW');

export default async function priceLookupRoutes(fastify: FastifyInstance) {
  const svc = () => new PriceResolutionService(fastify.prisma);

  // GET /price-lookup?itemId=&uomId=&customerId=&date=
  fastify.get<{ Querystring: { itemId: string; uomId: string; customerId?: string; date?: string } }>('/', {
    schema: {
      tags: ['Sales - Price Lists'],
      querystring: {
        type: 'object',
        required: ['itemId', 'uomId'],
        properties: {
          itemId: { type: 'string' },
          uomId: { type: 'string' },
          customerId: { type: 'string' },
          date: { type: 'string' },
        },
      },
    },
    preHandler: [VIEW],
  }, async (req, reply) => {
    const { itemId, uomId, customerId, date } = req.query;
    return reply.send(await svc().resolvePrice({ companyId: req.user.companyId, itemId, uomId, customerId, date }));
  });
}
