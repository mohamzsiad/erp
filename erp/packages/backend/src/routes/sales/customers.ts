import { FastifyInstance } from 'fastify';
import { CustomerService } from '../../services/sales/CustomerService.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = {
  VIEW:   requirePermission('SALES', 'CUSTOMERS', 'VIEW'),
  CREATE: requirePermission('SALES', 'CUSTOMERS', 'CREATE'),
  EDIT:   requirePermission('SALES', 'CUSTOMERS', 'EDIT'),
  CREDIT: requirePermission('SALES', 'CREDIT_CONTROL', 'EDIT'),
  CREDIT_APPROVE: requirePermission('SALES', 'CREDIT_CONTROL', 'APPROVE'),
};

const contactSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string' },
    role: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true },
    isPrimary: { type: 'boolean' },
  },
};

const addressSchema = {
  type: 'object',
  required: ['type', 'line1'],
  properties: {
    type: { type: 'string', enum: ['BILL_TO', 'SHIP_TO'] },
    name: { type: 'string', nullable: true },
    line1: { type: 'string' },
    line2: { type: 'string', nullable: true },
    line3: { type: 'string', nullable: true },
    line4: { type: 'string', nullable: true },
    line5: { type: 'string', nullable: true },
    countryId: { type: 'string', nullable: true },
    country: { type: 'string', nullable: true },
    cityId: { type: 'string', nullable: true },
    city: { type: 'string', nullable: true },
    postalCode: { type: 'string', nullable: true },
    street: { type: 'string', nullable: true },
    contactPerson: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true },
    mobile: { type: 'string', nullable: true },
    fax: { type: 'string', nullable: true },
    vatNo: { type: 'string', nullable: true },
    crNo: { type: 'string', nullable: true },
    taxCardNo: { type: 'string', nullable: true },
    isDefault: { type: 'boolean' },
  },
};

const companyTermSchema = {
  type: 'object',
  required: ['companyId'],
  properties: {
    companyId: { type: 'string' },
    salesmanId: { type: 'string', nullable: true },
    priceListId: { type: 'string', nullable: true },
    paymentTermId: { type: 'string', nullable: true },
    creditLimit: { type: 'number', minimum: 0 },
    creditExposureLimit: { type: 'number', minimum: 0 },
    closeToExpiryDays: { type: 'integer', nullable: true },
    isBlackListed: { type: 'boolean' },
    isGreyListed: { type: 'boolean' },
    isActive: { type: 'boolean' },
  },
};

const customerBodyProps = {
  code: { type: 'string', maxLength: 20 },
  name: { type: 'string', maxLength: 200 },
  tradeName: { type: 'string', nullable: true },
  type: { type: 'string', enum: ['COMPANY', 'INDIVIDUAL', 'GOVERNMENT'] },
  trn: { type: 'string', nullable: true },
  defaultTaxCodeId: { type: 'string', nullable: true },
  isTaxExempt: { type: 'boolean' },
  paymentTerms: { type: 'string', nullable: true },
  paymentTermId: { type: 'string', nullable: true },
  currencyId: { type: 'string', nullable: true },
  creditLimit: { type: 'number', minimum: 0 },
  creditHold: { type: 'boolean' },
  isBlackListed: { type: 'boolean' },
  priceListId: { type: 'string', nullable: true },
  salespersonId: { type: 'string', nullable: true },
  salesmanId: { type: 'string', nullable: true },
  categoryId: { type: 'string', nullable: true },
  notes: { type: 'string', nullable: true },
  isActive: { type: 'boolean' },
  contacts: { type: 'array', items: contactSchema },
  addresses: { type: 'array', items: addressSchema },
  companyTerms: { type: 'array', items: companyTermSchema },
  currencyIds: { type: 'array', items: { type: 'string' } },
};

export default async function customerRoutes(fastify: FastifyInstance) {
  const svc = () => new CustomerService(fastify.prisma);

  // GET /customers/search
  fastify.get<{ Querystring: { q: string } }>('/search', {
    schema: {
      tags: ['Sales - Customers'],
      querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string' } } },
    },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => {
    return reply.send(await svc().search(req.user.companyId, req.query.q));
  });

  // GET /customers/companies  (group companies for the company-terms grid)
  fastify.get('/companies', {
    schema: { tags: ['Sales - Customers'] },
    preHandler: [PERM.VIEW],
  }, async (_req, reply) => {
    return reply.send(await svc().listGroupCompanies());
  });

  // GET /customers/:id/effective-terms  (terms spooled onto sales documents)
  fastify.get<{ Params: { id: string } }>('/:id/effective-terms', {
    schema: {
      tags: ['Sales - Customers'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => {
    return reply.send(await svc().effectiveTerms(req.params.id, req.user.companyId));
  });

  // GET /customers
  fastify.get<{
    Querystring: { search?: string; categoryId?: string; isActive?: boolean; creditHold?: boolean; page?: number; limit?: number };
  }>('/', {
    schema: {
      tags: ['Sales - Customers'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          categoryId: { type: 'string' },
          isActive: { type: 'boolean' },
          creditHold: { type: 'boolean' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => {
    return reply.send(await svc().list({ companyId: req.user.companyId, ...req.query }));
  });

  // GET /customers/:id
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Sales - Customers'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => {
    return reply.send(await svc().getById(req.params.id, req.user.companyId));
  });

  // GET /customers/:id/financial-summary
  fastify.get<{ Params: { id: string } }>('/:id/financial-summary', {
    schema: {
      tags: ['Sales - Customers'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    preHandler: [PERM.VIEW],
  }, async (req, reply) => {
    return reply.send(await svc().financialSummary(req.params.id, req.user.companyId));
  });

  // POST /customers
  fastify.post<{ Body: any }>('/', {
    schema: {
      tags: ['Sales - Customers'],
      body: { type: 'object', required: ['name'], properties: customerBodyProps },
    },
    preHandler: [PERM.CREATE],
  }, async (req, reply) => {
    const result = await svc().create({ companyId: req.user.companyId, ...(req.body as any) }, req.user.userId);
    return reply.code(201).send(result);
  });

  // PUT /customers/:id
  fastify.put<{ Params: { id: string }; Body: any }>('/:id', {
    schema: {
      tags: ['Sales - Customers'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', properties: customerBodyProps },
    },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => {
    return reply.send(await svc().update(req.params.id, req.user.companyId, req.body as any, req.user.userId));
  });

  // POST /customers/:id/toggle-active
  fastify.post<{ Params: { id: string } }>('/:id/toggle-active', {
    schema: {
      tags: ['Sales - Customers'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    preHandler: [PERM.EDIT],
  }, async (req, reply) => {
    return reply.send(await svc().toggleActive(req.params.id, req.user.companyId, req.user.userId));
  });

  // POST /customers/:id/credit-hold  { hold: boolean }
  fastify.post<{ Params: { id: string }; Body: { hold: boolean } }>('/:id/credit-hold', {
    schema: {
      tags: ['Sales - Customers'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['hold'], properties: { hold: { type: 'boolean' } } },
    },
    preHandler: [PERM.CREDIT],
  }, async (req, reply) => {
    return reply.send(await svc().setCreditHold(req.params.id, req.user.companyId, req.body.hold, req.user.userId));
  });

  // POST /customers/:id/approve  (activate a pending onboarding customer)
  fastify.post<{ Params: { id: string } }>('/:id/approve', {
    schema: {
      tags: ['Sales - Customers'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    preHandler: [PERM.CREDIT_APPROVE],
  }, async (req, reply) => {
    return reply.send(await svc().approveOnboarding(req.params.id, req.user.companyId, req.user.userId));
  });
}
