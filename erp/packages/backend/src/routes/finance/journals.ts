import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { JournalService } from '../../services/finance/JournalService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('FINANCE', 'JOURNAL', 'VIEW'),
  CREATE: requirePermission('FINANCE', 'JOURNAL', 'CREATE'),
  EDIT:   requirePermission('FINANCE', 'JOURNAL', 'EDIT'),
};

const lineSchema = {
  type: 'object',
  required: ['accountId', 'debit', 'credit'],
  properties: {
    accountId:    { type: 'string' },
    costCenterId: { type: 'string' },
    debit:        { type: 'number', minimum: 0 },
    credit:       { type: 'number', minimum: 0 },
    currencyId:   { type: 'string' },
    fxRate:       { type: 'number', minimum: 0 },
    description:  { type: 'string' },
  },
};

export default async function journalRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new JournalService(req.server.prisma);

  // GET /journals
  fastify.get('/', {
    schema: {
      tags: ['Finance - Journals'],
      querystring: {
        type: 'object',
        properties: {
          status:       { type: 'string', enum: ['DRAFT', 'POSTED', 'REVERSED'] },
          sourceModule: { type: 'string' },
          search:       { type: 'string' },
          dateFrom:     { type: 'string', format: 'date' },
          dateTo:       { type: 'string', format: 'date' },
          page:         { type: 'integer', minimum: 1, default: 1 },
          limit:        { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return reply.send(await svc(req).list(req.user.companyId, req.query));
  });

  // GET /journals/:id
  fastify.get('/:id', {
    schema: { tags: ['Finance - Journals'], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send(await svc(req).getById(req.params.id, req.user.companyId));
  });

  // POST /journals — manual journal entry
  fastify.post('/', {
    schema: {
      tags: ['Finance - Journals'],
      body: {
        type: 'object',
        required: ['entryDate', 'description', 'lines'],
        properties: {
          entryDate:   { type: 'string', format: 'date' },
          description: { type: 'string', minLength: 1 },
          lines:       { type: 'array', items: lineSchema, minItems: 2 },
          sourceModule: { type: 'string', enum: ['MANUAL', 'PROCUREMENT', 'INVENTORY', 'AP', 'AR'] },
          sourceDocId:  { type: 'string' },
        },
      },
    },
    preHandler: [PERM.CREATE],
  }, async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const journal = await svc(req).postJournal({
      companyId:    req.user.companyId,
      entryDate:    new Date(req.body.entryDate),
      description:  req.body.description,
      lines:        req.body.lines,
      sourceModule: req.body.sourceModule ?? 'MANUAL',
      sourceDocId:  req.body.sourceDocId,
      userId:       req.user.userId,
    });
    return reply.code(201).send(journal);
  });

  // POST /journals/:id/reverse
  fastify.post('/:id/reverse', {
    schema: {
      tags: ['Finance - Journals'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: { entryDate: { type: 'string', format: 'date' } },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: { entryDate?: string } }>, reply: FastifyReply) => {
    const reversal = await svc(req).reverseJournal(
      req.params.id,
      req.user.companyId,
      req.user.userId,
      req.body.entryDate ? new Date(req.body.entryDate) : undefined
    );
    return reply.code(201).send(reversal);
  });
}
