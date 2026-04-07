import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../../services/AuthService.js';

// Request body schemas
const loginSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1 },
  },
};

const refreshSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string', minLength: 1 },
  },
};

const logoutSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string', minLength: 1 },
  },
};

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify.prisma, fastify.redis);

  // POST /api/v1/auth/login
  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login with email and password',
      body: loginSchema,
      response: {
        200: { type: 'object', additionalProperties: true },
        401: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (req: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
    const { email, password } = req.body;
    const ip = req.ip;
    const ua = req.headers['user-agent'];

    const result = await authService.login(email, password, ip, ua);
    return reply.code(200).send(result);
  });

  // POST /api/v1/auth/refresh
  fastify.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token using refresh token',
      body: refreshSchema,
    },
  }, async (req: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
    const result = await authService.refresh(req.body.refreshToken);
    return reply.code(200).send(result);
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout — revoke refresh token',
      body: logoutSchema,
    },
  }, async (req: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
    await authService.logout(req.body.refreshToken);
    return reply.code(200).send({ message: 'Logged out successfully' });
  });

  // GET /api/v1/auth/me  (requires JWT — applied in protected scope in app.ts)
  fastify.get('/me', {
    schema: {
      tags: ['Auth'],
      summary: 'Get current user profile and permissions',
      security: [{ bearerAuth: [] }],
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const result = await authService.getMe(userId);
    return reply.code(200).send(result);
  });
}
