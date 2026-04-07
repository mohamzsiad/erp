import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../../services/NotificationService.js';

export default async function notificationRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new NotificationService(req.server.prisma);

  // GET /notifications
  fastify.get('/', {
    schema: {
      tags: ['Notifications'],
      summary: 'Get notifications for the current user',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (req: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>, reply: FastifyReply) => {
    const result = await svc(req).getUnread(req.user.userId, req.query.page, req.query.limit);
    return reply.send(result);
  });

  // PUT /notifications/:id/read
  fastify.put('/:id/read', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark a notification as read',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await svc(req).markRead(req.params.id, req.user.userId);
    return reply.send(result);
  });

  // PUT /notifications/read-all
  fastify.put('/read-all', {
    schema: { tags: ['Notifications'], summary: 'Mark all notifications as read' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await svc(req).markAllRead(req.user.userId);
    return reply.send({ count: result.count, message: 'All notifications marked as read' });
  });
}
