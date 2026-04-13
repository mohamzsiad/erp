import { FastifyInstance } from 'fastify';
import { WorkflowService } from '../../services/WorkflowService.js';

export default async function workflowRoutes(fastify: FastifyInstance) {
  // GET /api/v1/workflow/my-tasks?limit=50
  fastify.get('/my-tasks', {
    schema: {
      tags: ['Workflow'],
      summary: 'Get pending approval tasks for the current user',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docType: { type: 'string' },
              docId: { type: 'string' },
              docNo: { type: 'string' },
              subject: { type: 'string' },
              requestedBy: { type: 'string' },
              requestedAt: { type: 'string' },
              status: { type: 'string' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { userId, companyId } = req.user;
    const service = new WorkflowService(req.server.prisma);
    const tasks = await service.getPendingTasksForUser(userId, companyId);
    const limit = (req.query as any).limit ?? 50;
    return reply.send(tasks.slice(0, limit));
  });

  // POST /api/v1/workflow/approve
  fastify.post('/approve', {
    schema: {
      tags: ['Workflow'],
      summary: 'Approve or reject a workflow document',
      body: {
        type: 'object',
        required: ['docType', 'docId', 'action'],
        properties: {
          docType: { type: 'string' },
          docId: { type: 'string' },
          action: { type: 'string', enum: ['approve', 'reject'] },
          comment: { type: 'string' },
          totalAmount: { type: 'number' },
          lineAdjustments: {
            type: 'array',
            items: {
              type: 'object',
              required: ['lineId', 'approvedQty'],
              properties: {
                lineId: { type: 'string' },
                approvedQty: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { userId } = req.user;
    const body = req.body as any;
    const service = new WorkflowService(req.server.prisma);
    const result = await service.processApproval({
      docType: body.docType,
      docId: body.docId,
      userId,
      action: body.action,
      comment: body.comment,
      totalAmount: body.totalAmount,
      lineAdjustments: body.lineAdjustments,
    });
    return reply.send(result);
  });

  // GET /api/v1/workflow/history/:docType/:docId
  fastify.get('/history/:docType/:docId', {
    schema: {
      tags: ['Workflow'],
      summary: 'Get approval history for a document',
      params: {
        type: 'object',
        required: ['docType', 'docId'],
        properties: {
          docType: { type: 'string' },
          docId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { docType, docId } = req.params as { docType: string; docId: string };
    const service = new WorkflowService(req.server.prisma);
    const history = await service.getApprovalStatus(docType as any, docId);
    return reply.send(history);
  });
}
