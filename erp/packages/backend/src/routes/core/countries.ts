import { FastifyInstance } from 'fastify';
import { CountryService } from '../../services/core/CountryService.js';

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

const countryProps = {
  code: { type: 'string', maxLength: 3 },
  name: { type: 'string', maxLength: 100 },
  vatPrefix: { type: 'string', nullable: true },
  vatLength: { type: 'integer', nullable: true },
  vatFormatHint: { type: 'string', nullable: true },
  isActive: { type: 'boolean' },
};

/**
 * Country / city reference data. Readable by any signed-in user (every address
 * form needs it); maintenance is gated on the admin CONFIGURE permission.
 */
export default async function countryRoutes(fastify: FastifyInstance) {
  const svc = () => new CountryService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; isActive?: boolean } }>('/', {
    schema: {
      tags: ['Core - Countries'],
      querystring: { type: 'object', properties: { search: { type: 'string' }, isActive: { type: 'boolean' } } },
    },
  }, async (req, reply) => reply.send(await svc().list(req.query)));

  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Core - Countries'], params: idParam },
  }, async (req, reply) => reply.send(await svc().getById(req.params.id)));

  // GET /countries/:id/cities  — the address screen's city dropdown
  fastify.get<{ Params: { id: string }; Querystring: { search?: string } }>('/:id/cities', {
    schema: {
      tags: ['Core - Countries'],
      params: idParam,
      querystring: { type: 'object', properties: { search: { type: 'string' } } },
    },
  }, async (req, reply) => reply.send(await svc().cities(req.params.id, req.query)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Core - Countries'], body: { type: 'object', required: ['code', 'name'], properties: countryProps } },
  }, async (req, reply) => reply.code(201).send(await svc().create(req.body as any)));

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: { tags: ['Core - Countries'], params: idParam, body: { type: 'object', properties: countryProps } },
  }, async (req, reply) => reply.send(await svc().update(req.params.id, req.body as any)));

  fastify.post<{ Params: { id: string }; Body: { code: string; name: string; isActive?: boolean } }>('/:id/cities', {
    schema: {
      tags: ['Core - Countries'],
      params: idParam,
      body: {
        type: 'object', required: ['code', 'name'],
        properties: { code: { type: 'string', maxLength: 20 }, name: { type: 'string', maxLength: 100 }, isActive: { type: 'boolean' } },
      },
    },
  }, async (req, reply) => reply.code(201).send(await svc().addCity(req.params.id, req.body)));

  fastify.delete<{ Params: { id: string; cityId: string } }>('/:id/cities/:cityId', {
    schema: {
      tags: ['Core - Countries'],
      params: { type: 'object', required: ['id', 'cityId'], properties: { id: { type: 'string' }, cityId: { type: 'string' } } },
    },
  }, async (req, reply) => reply.send(await svc().removeCity(req.params.id, req.params.cityId)));
}
