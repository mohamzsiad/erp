import { FastifyInstance } from 'fastify';
import customerRoutes from './customers.js';
import priceListRoutes from './priceLists.js';
import priceLookupRoutes from './priceLookup.js';
import enquiryRoutes from './enquiries.js';
import quotationRoutes from './quotations.js';
import orderRoutes from './orders.js';

export default async function salesRoutes(fastify: FastifyInstance) {
  await fastify.register(customerRoutes, { prefix: '/customers' });
  await fastify.register(priceListRoutes, { prefix: '/price-lists' });
  await fastify.register(priceLookupRoutes, { prefix: '/price-lookup' });
  await fastify.register(enquiryRoutes, { prefix: '/enquiries' });
  await fastify.register(quotationRoutes, { prefix: '/quotations' });
  await fastify.register(orderRoutes, { prefix: '/orders' });
}
