import { FastifyInstance } from 'fastify';
import { SalesReportService } from '../../services/sales/SalesReportService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const VIEW = requirePermission('SALES', 'REPORTS', 'VIEW');

export default async function reportRoutes(fastify: FastifyInstance) {
  const svc = () => new SalesReportService(fastify.prisma);

  fastify.get('/pipeline', { schema: { tags: ['Sales - Reports'] }, preHandler: [VIEW] }, async (req, reply) => reply.send(await svc().pipeline(req.user.companyId)));
  fastify.get('/order-book', { schema: { tags: ['Sales - Reports'] }, preHandler: [VIEW] }, async (req, reply) => reply.send(await svc().orderBook(req.user.companyId)));

  fastify.get<{ Querystring: { dateFrom?: string; dateTo?: string } }>('/sales-register', {
    schema: { tags: ['Sales - Reports'], querystring: { type: 'object', properties: { dateFrom: { type: 'string' }, dateTo: { type: 'string' } } } },
    preHandler: [VIEW],
  }, async (req, reply) => reply.send(await svc().salesRegister(req.user.companyId, req.query)));

  fastify.get<{ Querystring: { dateFrom?: string; dateTo?: string } }>('/vat', {
    schema: { tags: ['Sales - Reports'], querystring: { type: 'object', properties: { dateFrom: { type: 'string' }, dateTo: { type: 'string' } } } },
    preHandler: [VIEW],
  }, async (req, reply) => reply.send(await svc().vatReport(req.user.companyId, req.query)));

  fastify.get('/customer-ageing', { schema: { tags: ['Sales - Reports'] }, preHandler: [VIEW] }, async (req, reply) => reply.send(await svc().customerAgeing(req.user.companyId)));
  fastify.get('/boq-progress', { schema: { tags: ['Sales - Reports'] }, preHandler: [VIEW] }, async (req, reply) => reply.send(await svc().boqProgress(req.user.companyId)));
}
