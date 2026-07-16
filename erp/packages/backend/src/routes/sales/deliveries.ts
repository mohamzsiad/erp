import { FastifyInstance } from 'fastify';
import { DeliveryNoteService } from '../../services/sales/DeliveryNoteService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('SALES', 'DELIVERY_NOTE', 'VIEW'),
  CREATE: requirePermission('SALES', 'DELIVERY_NOTE', 'CREATE'),
  EDIT:   requirePermission('SALES', 'DELIVERY_NOTE', 'EDIT'),
};

const lineSchema = {
  type: 'object', required: ['itemId', 'uomId', 'deliveredQty'],
  properties: {
    salesOrderLineId: { type: 'string', nullable: true }, itemId: { type: 'string' }, uomId: { type: 'string' },
    deliveredQty: { type: 'number', minimum: 0 }, binId: { type: 'string', nullable: true },
  },
};
const bodyProps = {
  customerId: { type: 'string' }, salesOrderId: { type: 'string', nullable: true }, deliveryDate: { type: 'string' },
  shipToAddressId: { type: 'string', nullable: true }, warehouseId: { type: 'string' }, vehicleNo: { type: 'string', nullable: true },
  driver: { type: 'string', nullable: true }, notes: { type: 'string', nullable: true }, lines: { type: 'array', items: lineSchema },
};
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export default async function deliveryRoutes(fastify: FastifyInstance) {
  const svc = () => new DeliveryNoteService(fastify.prisma);

  fastify.get<{ Querystring: { search?: string; status?: string; customerId?: string; page?: number; limit?: number } }>('/', {
    schema: { tags: ['Sales - Deliveries'], querystring: { type: 'object', properties: {
      search: { type: 'string' }, status: { type: 'string' }, customerId: { type: 'string' },
      page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().list(req.user.companyId, req.query)));

  // Open (undelivered) lines for a sales order — feeds the delivery form.
  fastify.get<{ Params: { orderId: string } }>('/open-lines/:orderId', {
    schema: { tags: ['Sales - Deliveries'], params: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'string' } } } },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().openOrderLines(req.user.companyId, req.params.orderId)));

  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Sales - Deliveries'], params: idParam }, preHandler: [PERM.VIEW],
  }, async (req, reply) => reply.send(await svc().getById(req.params.id, req.user.companyId)));

  fastify.post<{ Body: any }>('/', {
    schema: { tags: ['Sales - Deliveries'], body: { type: 'object', required: ['customerId', 'deliveryDate', 'warehouseId', 'lines'], properties: bodyProps } },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => reply.code(201).send(await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId)));

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: { tags: ['Sales - Deliveries'], params: idParam, body: { type: 'object', properties: bodyProps } },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/post', {
    schema: { tags: ['Sales - Deliveries'], params: idParam }, preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().post(req.params.id, req.user.companyId, req.user.userId)));

  fastify.post<{ Params: { id: string } }>('/:id/acknowledge', {
    schema: { tags: ['Sales - Deliveries'], params: idParam }, preHandler: [PERM.EDIT],
  }, async (req, reply) => reply.send(await svc().acknowledge(req.params.id, req.user.companyId, req.user.userId)));
}
