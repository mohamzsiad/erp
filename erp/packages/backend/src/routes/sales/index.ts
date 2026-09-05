import { FastifyInstance } from 'fastify';
import customerRoutes from './customers.js';
import salesmanRoutes from './salesmen.js';
import paymentTermRoutes from './paymentTerms.js';
import priceListRoutes from './priceLists.js';
import priceLookupRoutes from './priceLookup.js';
import enquiryRoutes from './enquiries.js';
import quotationRoutes from './quotations.js';
import orderRoutes from './orders.js';
import deliveryRoutes from './deliveries.js';
import invoiceRoutes from './invoices.js';
import returnRoutes from './returns.js';
import creditNoteRoutes from './creditNotes.js';
import contractRoutes from './contracts.js';
import progressBillRoutes from './progressBills.js';
import reportRoutes from './reports.js';
import salesDashboardRoutes from './dashboard.js';

export default async function salesRoutes(fastify: FastifyInstance) {
  await fastify.register(customerRoutes, { prefix: '/customers' });
  await fastify.register(salesmanRoutes, { prefix: '/salesmen' });
  await fastify.register(paymentTermRoutes, { prefix: '/payment-terms' });
  await fastify.register(priceListRoutes, { prefix: '/price-lists' });
  await fastify.register(priceLookupRoutes, { prefix: '/price-lookup' });
  await fastify.register(enquiryRoutes, { prefix: '/enquiries' });
  await fastify.register(quotationRoutes, { prefix: '/quotations' });
  await fastify.register(orderRoutes, { prefix: '/orders' });
  await fastify.register(deliveryRoutes, { prefix: '/deliveries' });
  await fastify.register(invoiceRoutes, { prefix: '/invoices' });
  await fastify.register(returnRoutes, { prefix: '/returns' });
  await fastify.register(creditNoteRoutes, { prefix: '/credit-notes' });
  await fastify.register(contractRoutes, { prefix: '/contracts' });
  await fastify.register(progressBillRoutes, { prefix: '/progress-bills' });
  await fastify.register(reportRoutes, { prefix: '/reports' });
  await fastify.register(salesDashboardRoutes, { prefix: '/dashboard' });
}
