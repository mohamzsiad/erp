import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../../services/NotificationService.js';

// In-memory map: userId → Set of WebSocket connections
// This allows pushing real-time notifications when they're created
const wsClients = new Map<string, Set<any>>();

export function broadcastNotification(userId: string, notification: object) {
  const conns = wsClients.get(userId);
  if (!conns) return;
  const msg = JSON.stringify({ type: 'notification', data: notification });
  for (const ws of conns) {
    try { ws.send(msg); } catch { /* ignore closed connections */ }
  }
}

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
          page:   { type: 'integer', minimum: 1, default: 1 },
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          unread: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Querystring: { page?: number; limit?: number; unread?: boolean } }>, reply: FastifyReply) => {
    const result = await svc(req).getUnread(req.user.userId, req.query.page, req.query.limit);
    return reply.send(result);
  });

  // GET /notifications/unread-count
  fastify.get('/unread-count', {
    schema: {
      tags: ['Notifications'],
      summary: 'Get unread notification count',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const count = await req.server.prisma.notification.count({
      where: { userId: req.user.userId, isRead: false },
    });
    return reply.send({ count });
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

  // WebSocket: GET /notifications/ws — real-time push
  fastify.get('/ws', { websocket: true }, (socket: any, req: FastifyRequest) => {
    const userId = req.user?.userId;
    if (!userId) { socket.close(); return; }

    // Register connection
    if (!wsClients.has(userId)) wsClients.set(userId, new Set());
    wsClients.get(userId)!.add(socket);

    // Send unread count on connect
    req.server.prisma.notification.count({ where: { userId, isRead: false } })
      .then(count => {
        socket.send(JSON.stringify({ type: 'unread_count', count }));
      }).catch(() => {});

    socket.on('message', (msg: Buffer) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }));
      } catch { /* ignore */ }
    });

    socket.on('close', () => {
      wsClients.get(userId)?.delete(socket);
      if (wsClients.get(userId)?.size === 0) wsClients.delete(userId);
    });
  });
}
