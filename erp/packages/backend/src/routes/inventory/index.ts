import { FastifyInstance } from 'fastify';
import itemRoutes         from './items.js';
import warehouseRoutes    from './warehouses.js';
import binRoutes          from './bins.js';
import grnRoutes          from './grn.js';
import issueRoutes        from './issue.js';
import transferRoutes     from './transfer.js';
import adjustmentRoutes   from './adjustment.js';
import physicalCountRoutes from './physical-count.js';
import stockSummaryRoutes   from './stock-summary.js';
import inventoryReportRoutes from './reports.js';

export default async function inventoryRoutes(fastify: FastifyInstance) {
  await fastify.register(itemRoutes,          { prefix: '/items' });
  await fastify.register(warehouseRoutes,     { prefix: '/warehouses' });
  await fastify.register(binRoutes,           { prefix: '/bins' });
  await fastify.register(grnRoutes,           { prefix: '/grn' });
  await fastify.register(issueRoutes,         { prefix: '/issue' });
  await fastify.register(transferRoutes,      { prefix: '/transfer' });
  await fastify.register(adjustmentRoutes,    { prefix: '/adjustment' });
  await fastify.register(physicalCountRoutes, { prefix: '/physical-count' });
  await fastify.register(stockSummaryRoutes,    { prefix: '/stock-summary' });
  await fastify.register(inventoryReportRoutes, { prefix: '/reports' });
}
