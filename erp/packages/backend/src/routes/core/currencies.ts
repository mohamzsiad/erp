import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function currencyRoutes(fastify: FastifyInstance) {
  fastify.get('/search', {
    schema: {
      tags: ['Core - Currencies'],
      querystring: {
        type: 'object',
        properties: { q: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest<{ Querystring: { q?: string } }>, reply: FastifyReply) => {
    const { q = '' } = req.query;
    const currencies = await req.server.prisma.currency.findMany({
      where: {
        companyId: req.user.companyId,
        ...(q && {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      select: { id: true, code: true, name: true, symbol: true },
      orderBy: { code: 'asc' },
      take: 50,
    });
    return reply.send(currencies);
  });
}
