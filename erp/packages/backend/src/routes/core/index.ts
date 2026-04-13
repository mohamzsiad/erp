import { FastifyInstance } from 'fastify';
import locationRoutes from './locations.js';

export default async function coreRoutes(fastify: FastifyInstance) {
  await fastify.register(locationRoutes, { prefix: '/locations' });
}
