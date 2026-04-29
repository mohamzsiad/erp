import { FastifyInstance } from 'fastify';
import locationRoutes from './locations.js';
import costCodeRoutes from './costCodes.js';
import currencyRoutes from './currencies.js';

export default async function coreRoutes(fastify: FastifyInstance) {
  await fastify.register(locationRoutes, { prefix: '/locations' });
  await fastify.register(costCodeRoutes, { prefix: '/cost-codes' });
  await fastify.register(currencyRoutes, { prefix: '/currencies' });
}
