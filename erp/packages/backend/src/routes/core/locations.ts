import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function locationRoutes(fastify: FastifyInstance) {
  // GET /locations/search?q=
  fastify.get('/search', {
    schema: {
      tags: ['Core - Locations'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Querystring: { q?: string } }>, reply: FastifyReply) => {
    const { q = '' } = req.query;
    const locations = await req.server.prisma.location.findMany({
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
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
      orderBy: { name: 'asc' },
      take: 50,
    });
    return reply.send(locations);
  });

  // GET /locations
  fastify.get('/', {
    schema: {
      tags: ['Core - Locations'],
      querystring: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Querystring: { isActive?: boolean } }>, reply: FastifyReply) => {
    const { isActive } = req.query;
    const locations = await req.server.prisma.location.findMany({
      where: {
        companyId: req.user.companyId,
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
    return reply.send(locations);
  });
}
