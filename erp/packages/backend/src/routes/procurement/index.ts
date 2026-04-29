import { FastifyInstance } from 'fastify';
import supplierRoutes from './suppliers.js';
import mrlRoutes from './mrl.js';
import prlRoutes from './prl.js';
import prSubSectionRoutes from './pr-subsections.js';
import enquiryRoutes from './enquiry.js';
import quotationRoutes from './quotation.js';
import poRoutes from './po.js';
import reportRoutes from './reports.js';

export default async function procurementRoutes(fastify: FastifyInstance) {
  await fastify.register(supplierRoutes, { prefix: '/suppliers' });
  await fastify.register(mrlRoutes, { prefix: '/mrl' });
  await fastify.register(prlRoutes, { prefix: '/prl' });
  await fastify.register(prSubSectionRoutes, { prefix: '/prl' });  // nested: /prl/:prlId/lines/:lineId/...
  await fastify.register(enquiryRoutes, { prefix: '/enquiry' });
  await fastify.register(quotationRoutes, { prefix: '/quotation' });
  await fastify.register(poRoutes, { prefix: '/po' });
  await fastify.register(reportRoutes, { prefix: '/reports' });
}
