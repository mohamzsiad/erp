import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AccountMappingService } from '../../services/finance/AccountMappingService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('FINANCE', 'ACCOUNT_MAPPING', 'VIEW'),
  EDIT:   requirePermission('FINANCE', 'ACCOUNT_MAPPING', 'EDIT'),
  DELETE: requirePermission('FINANCE', 'ACCOUNT_MAPPING', 'DELETE'),
};

const MAPPING_TYPES = [
  'INVENTORY_ACCOUNT',
  'SUPPLIER_CONTROL',
  'CUSTOMER_CONTROL',
  'GRN_CLEARING',
  'BANK_ACCOUNT',
  'AP_EXPENSE',
  'AR_REVENUE',
] as const;

export default async function accountMappingRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new AccountMappingService(req.server.prisma);

  // GET /account-mappings
  fastify.get('/', {
    schema: { tags: ['Finance - Account Mappings'] },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await svc(req).list(req.user.companyId));
  });

  // PUT /account-mappings  — upsert a mapping
  fastify.put('/', {
    schema: {
      tags: ['Finance - Account Mappings'],
      body: {
        type: 'object',
        required: ['mappingType', 'accountId'],
        properties: {
          mappingType: { type: 'string', enum: MAPPING_TYPES as unknown as string[] },
          accountId:   { type: 'string' },
          refId:       { type: 'string' },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    return reply.send(
      await svc(req).upsert(req.user.companyId, req.body.mappingType, req.body.accountId, req.body.refId)
    );
  });

  // DELETE /account-mappings/:id
  fastify.delete('/:id', {
    schema: {
      tags: ['Finance - Account Mappings'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [PERM.DELETE],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await svc(req).delete(req.params.id, req.user.companyId);
    return reply.code(204).send();
  });
}
