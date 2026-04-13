import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GlAccountService } from '../../services/finance/GlAccountService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('FINANCE', 'GL_ACCOUNT', 'VIEW'),
  CREATE: requirePermission('FINANCE', 'GL_ACCOUNT', 'CREATE'),
  EDIT:   requirePermission('FINANCE', 'GL_ACCOUNT', 'EDIT'),
  DELETE: requirePermission('FINANCE', 'GL_ACCOUNT', 'DELETE'),
};

export default async function accountRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new GlAccountService(req.server.prisma);

  // GET /accounts
  fastify.get('/', {
    schema: {
      tags: ['Finance - GL Accounts'],
      querystring: {
        type: 'object',
        properties: {
          accountType: { type: 'string', enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] },
          isActive:    { type: 'boolean' },
          search:      { type: 'string' },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).list(req.user.companyId, req.query));
  });

  // GET /accounts/tree
  fastify.get('/tree', { schema: { tags: ['Finance - GL Accounts'] }, preHandler: [PERM.VIEW] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      return reply.send(await svc(req).tree(req.user.companyId));
    }
  );

  // GET /accounts/search
  fastify.get('/search', {
    schema: {
      tags: ['Finance - GL Accounts'],
      querystring: {
        type: 'object',
        properties: {
          q:        { type: 'string' },
          leafOnly: { type: 'boolean' },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: { q?: string; leafOnly?: boolean } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).search(req.user.companyId, req.query.q ?? '', req.query.leafOnly));
  });

  // GET /accounts/:id
  fastify.get('/:id', {
    schema: { tags: ['Finance - GL Accounts'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  // POST /accounts
  fastify.post('/', {
    schema: {
      tags: ['Finance - GL Accounts'],
      body: {
        type: 'object',
        required: ['code', 'name', 'accountType'],
        properties: {
          code:        { type: 'string' },
          name:        { type: 'string' },
          accountType: { type: 'string', enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] },
          parentId:    { type: 'string' },
          isControl:   { type: 'boolean' },
          currencyId:  { type: 'string' },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.code(201).send(await svc(req).create(req.user.companyId, req.body));
  });

  // PUT /accounts/:id
  fastify.put('/:id', {
    schema: {
      tags: ['Finance - GL Accounts'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          name:       { type: 'string' },
          isControl:  { type: 'boolean' },
          isActive:   { type: 'boolean' },
          currencyId: { type: 'string' },
          parentId:   { type: 'string' },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).update(req.params.id, req.user.companyId, req.body));
  });

  // DELETE /accounts/:id
  fastify.delete('/:id', {
    schema: { tags: ['Finance - GL Accounts'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.DELETE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await svc(req).delete(req.params.id, req.user.companyId);
    return reply.code(204).send();
  });
}
