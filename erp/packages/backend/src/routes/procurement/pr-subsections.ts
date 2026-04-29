/**
 * PR Sub-section Routes
 * All routes are nested under /prl/:prlId/lines/:lineId/
 * Routes: delivery-schedule, account-details, alternate-items,
 *         item-status, short-close, attachments, lead-time
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrSubSectionService } from '../../services/procurement/PrSubSectionService.js';
import { requirePermission } from '../../middleware/authenticate.js';
import multipart from '@fastify/multipart';

const PERM = {
  VIEW:   requirePermission('PROCUREMENT', 'PRL', 'VIEW'),
  EDIT:   requirePermission('PROCUREMENT', 'PRL', 'EDIT'),
  APPROVE: requirePermission('PROCUREMENT', 'PRL', 'APPROVE'),
};

// ── Line param extraction helper ─────────────────────────────────────────────
type LineParams = { Params: { prlId: string; lineId: string } };

export default async function prSubSectionRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new PrSubSectionService(req.server.prisma);

  // Register multipart for file uploads (scoped to this plugin)
  await fastify.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });

  const lineParamSchema = {
    type: 'object',
    required: ['prlId', 'lineId'],
    properties: {
      prlId:  { type: 'string' },
      lineId: { type: 'string' },
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DELIVERY SCHEDULE
  // ═══════════════════════════════════════════════════════════════════════════

  fastify.get('/:prlId/lines/:lineId/delivery-schedule', {
    schema: { tags: ['Procurement - PR Sub-sections'], params: lineParamSchema },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<LineParams>, reply: FastifyReply) => {
    const data = await svc(req).getDeliverySchedules(req.params.lineId, req.user.companyId);
    return reply.send(data);
  });

  fastify.post('/:prlId/lines/:lineId/delivery-schedule', {
    schema: {
      tags: ['Procurement - PR Sub-sections'],
      params: lineParamSchema,
      body: {
        type: 'object',
        required: ['rows'],
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              required: ['deliveryDate', 'qty'],
              properties: {
                id:           { type: 'string' },
                deliveryDate: { type: 'string', format: 'date' },
                qty:          { type: 'number', exclusiveMinimum: 0 },
                locationId:   { type: 'string' },
                remarks:      { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<LineParams & { Body: { rows: any[] } }>, reply: FastifyReply) => {
    const data = await svc(req).upsertDeliverySchedules(
      req.params.lineId, req.user.companyId, req.body.rows
    );
    return reply.send(data);
  });

  fastify.delete('/:prlId/lines/:lineId/delivery-schedule/:scheduleId', {
    schema: {
      tags: ['Procurement - PR Sub-sections'],
      params: { ...lineParamSchema, properties: { ...lineParamSchema.properties, scheduleId: { type: 'string' } }, required: [...lineParamSchema.required, 'scheduleId'] },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { prlId: string; lineId: string; scheduleId: string } }>, reply: FastifyReply) => {
    await svc(req).deleteDeliverySchedule(req.params.scheduleId, req.params.lineId, req.user.companyId);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ACCOUNT DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  fastify.get('/:prlId/lines/:lineId/account-details', {
    schema: { tags: ['Procurement - PR Sub-sections'], params: lineParamSchema },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<LineParams>, reply: FastifyReply) => {
    const data = await svc(req).getAccountDetails(req.params.lineId, req.user.companyId);
    return reply.send(data);
  });

  fastify.post('/:prlId/lines/:lineId/account-details', {
    schema: {
      tags: ['Procurement - PR Sub-sections'],
      params: lineParamSchema,
      body: {
        type: 'object',
        required: ['rows'],
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              required: ['glAccountId', 'costCentreId', 'percentage', 'budgetYear'],
              properties: {
                id:            { type: 'string' },
                glAccountId:   { type: 'string' },
                costCentreId:  { type: 'string' },
                projectCode:   { type: 'string' },
                percentage:    { type: 'number', exclusiveMinimum: 0, maximum: 100 },
                budgetYear:    { type: 'integer' },
              },
            },
            minItems: 1,
          },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<LineParams & { Body: { rows: any[] } }>, reply: FastifyReply) => {
    const data = await svc(req).upsertAccountDetails(
      req.params.lineId, req.user.companyId, req.body.rows
    );
    return reply.send(data);
  });

  fastify.delete('/:prlId/lines/:lineId/account-details/:detailId', {
    schema: { tags: ['Procurement - PR Sub-sections'] },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { prlId: string; lineId: string; detailId: string } }>, reply: FastifyReply) => {
    await svc(req).deleteAccountDetail(req.params.detailId, req.params.lineId, req.user.companyId);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ALTERNATE ITEMS
  // ═══════════════════════════════════════════════════════════════════════════

  fastify.get('/:prlId/lines/:lineId/alternate-items', {
    schema: { tags: ['Procurement - PR Sub-sections'], params: lineParamSchema },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<LineParams>, reply: FastifyReply) => {
    const data = await svc(req).getAlternateItems(req.params.lineId, req.user.companyId);
    return reply.send(data);
  });

  fastify.post('/:prlId/lines/:lineId/alternate-items', {
    schema: {
      tags: ['Procurement - PR Sub-sections'],
      params: lineParamSchema,
      body: {
        type: 'object',
        required: ['rows'],
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              required: ['itemId', 'priority'],
              properties: {
                id:          { type: 'string' },
                itemId:      { type: 'string' },
                grade1:      { type: 'string' },
                grade2:      { type: 'string' },
                uom:         { type: 'string' },
                approxPrice: { type: 'number', minimum: 0 },
                priority:    { type: 'integer', minimum: 1 },
                remarks:     { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<LineParams & { Body: { rows: any[] } }>, reply: FastifyReply) => {
    const data = await svc(req).upsertAlternateItems(
      req.params.lineId, req.user.companyId, req.body.rows
    );
    return reply.send(data);
  });

  fastify.delete('/:prlId/lines/:lineId/alternate-items/:altId', {
    schema: { tags: ['Procurement - PR Sub-sections'] },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { prlId: string; lineId: string; altId: string } }>, reply: FastifyReply) => {
    await svc(req).deleteAlternateItem(req.params.altId, req.params.lineId, req.user.companyId);
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ITEM STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  fastify.get('/:prlId/lines/:lineId/item-status', {
    schema: { tags: ['Procurement - PR Sub-sections'], params: lineParamSchema },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<LineParams>, reply: FastifyReply) => {
    const data = await svc(req).getItemStatus(req.params.lineId, req.user.companyId);
    return reply.send(data);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SHORT CLOSE
  // ═══════════════════════════════════════════════════════════════════════════

  fastify.get('/:prlId/lines/:lineId/short-close', {
    schema: { tags: ['Procurement - PR Sub-sections'], params: lineParamSchema },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<LineParams>, reply: FastifyReply) => {
    const data = await svc(req).getShortCloseInfo(req.params.lineId, req.user.companyId);
    return reply.send(data);
  });

  fastify.post('/:prlId/lines/:lineId/short-close', {
    schema: {
      tags: ['Procurement - PR Sub-sections'],
      params: lineParamSchema,
      body: {
        type: 'object',
        required: ['qty', 'reason'],
        properties: {
          qty:    { type: 'number', exclusiveMinimum: 0 },
          reason: { type: 'string', minLength: 1 },
        },
      },
    },
    preHandler: [PERM.APPROVE],
  }, async (req: FastifyRequest<LineParams & { Body: { qty: number; reason: string } }>, reply: FastifyReply) => {
    const data = await svc(req).shortCloseLine(
      req.params.lineId, req.user.companyId, req.user.userId, req.body.qty, req.body.reason
    );
    return reply.send(data);
  });

  fastify.post('/:prlId/lines/:lineId/reopen', {
    schema: { tags: ['Procurement - PR Sub-sections'], params: lineParamSchema },
    preHandler: [PERM.APPROVE],
  }, async (req: FastifyRequest<LineParams>, reply: FastifyReply) => {
    const data = await svc(req).reopenLine(
      req.params.lineId, req.user.companyId, req.user.userId
    );
    return reply.send(data);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. ATTACHMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  fastify.get('/:prlId/lines/:lineId/attachments', {
    schema: { tags: ['Procurement - PR Sub-sections'], params: lineParamSchema },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<LineParams>, reply: FastifyReply) => {
    const data = await svc(req).getAttachments(req.params.lineId, req.user.companyId);
    return reply.send(data);
  });

  fastify.post('/:prlId/lines/:lineId/attachments', {
    schema: { tags: ['Procurement - PR Sub-sections'], params: lineParamSchema },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<LineParams>, reply: FastifyReply) => {
    const data = await req.file();
    if (!data) throw fastify.httpErrors.badRequest('No file provided');

    const buffer = await data.toBuffer();
    const attachment = await svc(req).uploadAttachment(
      req.params.lineId,
      req.user.companyId,
      req.user.userId,
      { filename: data.filename, mimetype: data.mimetype, buffer }
    );
    return reply.code(201).send(attachment);
  });

  fastify.delete('/:prlId/lines/:lineId/attachments/:attachmentId', {
    schema: { tags: ['Procurement - PR Sub-sections'] },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<{ Params: { prlId: string; lineId: string; attachmentId: string } }>, reply: FastifyReply) => {
    await svc(req).deleteAttachment(
      req.params.attachmentId, req.params.lineId, req.user.companyId, req.user.userId
    );
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. LEAD TIME
  // ═══════════════════════════════════════════════════════════════════════════

  fastify.get('/:prlId/lines/:lineId/lead-time', {
    schema: { tags: ['Procurement - PR Sub-sections'], params: lineParamSchema },
    preHandler: [PERM.VIEW],
  }, async (req: FastifyRequest<LineParams>, reply: FastifyReply) => {
    const data = await svc(req).getLeadTime(req.params.lineId, req.user.companyId);
    return reply.send(data);
  });

  fastify.patch('/:prlId/lines/:lineId/lead-time', {
    schema: {
      tags: ['Procurement - PR Sub-sections'],
      params: lineParamSchema,
      body: {
        type: 'object',
        required: ['leadTimeDays'],
        properties: {
          leadTimeDays: { type: ['integer', 'null'], minimum: 0 },
        },
      },
    },
    preHandler: [PERM.EDIT],
  }, async (req: FastifyRequest<LineParams & { Body: { leadTimeDays: number | null } }>, reply: FastifyReply) => {
    const data = await svc(req).updateLeadTime(
      req.params.lineId, req.user.companyId, req.body.leadTimeDays
    );
    return reply.send(data);
  });
}
