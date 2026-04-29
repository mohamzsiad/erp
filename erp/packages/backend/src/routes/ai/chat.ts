import { FastifyInstance } from 'fastify';
import { ChatService, type ChatMessage } from '../../services/ai/ChatService.js';

const bodySchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1, maxLength: 2000 },
    history: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role:    { type: 'string', enum: ['user', 'assistant'] },
          content: { type: 'string', maxLength: 4000 },
        },
      },
    },
  },
} as const;

export default async function aiChatRoutes(fastify: FastifyInstance) {
  const svc = new ChatService(fastify.prisma);

  fastify.post<{
    Body: { message: string; history?: ChatMessage[] };
  }>(
    '/chat',
    {
      schema: {
        tags: ['AI'],
        summary: 'Natural language ERP query',
        body: bodySchema,
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const companyId = req.user.companyId;
      const { message, history = [] } = req.body;

      try {
        const result = await svc.chat(message, history, companyId);
        return reply.send(result);
      } catch (err: unknown) {
        req.log.error({ err }, 'AI chat error');
        const msg = err instanceof Error ? err.message : 'AI service error';
        return reply.code(500).send({ statusCode: 500, error: 'AI Error', message: msg });
      }
    },
  );
}
