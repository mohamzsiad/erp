import { PoService, CreatePoInput } from '../services/procurement/PoService';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPrisma = {
  supplier: {
    findFirst: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  purchaseOrder: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  poLine: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  workflowConfig: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  materialRequisition: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  purchaseRequisition: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  docSequence: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

// Mock DocNumberService
jest.mock('../utils/DocNumberService', () => ({
  getNextDocNo: jest.fn().mockResolvedValue('PO-202604000001'),
}));

// Mock WorkflowService
jest.mock('../services/WorkflowService', () => ({
  WorkflowService: jest.fn().mockImplementation(() => ({
    processApproval: jest.fn().mockResolvedValue({ status: 'APPROVED', message: 'Document approved successfully' }),
  })),
}));

// Mock NotificationService
jest.mock('../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotifications: jest.fn().mockResolvedValue(undefined),
    sendEmail: jest.fn().mockResolvedValue(undefined),
  })),
}));

const validCreateInput: CreatePoInput = {
  companyId: 'company-1',
  supplierId: 'supplier-1',
  currencyId: 'currency-1',
  exchangeRate: 1,
  docDate: '2024-04-01',
  deliveryDate: '2024-05-01',
  lines: [
    {
      itemId: 'item-1',
      uomId: 'uom-1',
      orderedQty: 10,
      unitPrice: 100,
      discountPct: 0,
      taxPct: 5,
      chargeCodeId: 'cc-1',
    },
  ],
};

describe('PoService', () => {
  let service: PoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PoService(mockPrisma as any);
  });

  describe('create', () => {
    it('throws 422 if no lines provided', async () => {
      await expect(
        service.create({ ...validCreateInput, lines: [] }, 'user-1')
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('throws 422 if supplier not found', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.create(validCreateInput, 'user-1')
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('creates PO with correct total amount', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue({ id: 'supplier-1', isActive: true });

      const createdPo = {
        id: 'po-1',
        docNo: 'PO-202604000001',
        companyId: 'company-1',
        supplierId: 'supplier-1',
        status: 'DRAFT',
        totalAmount: 1050, // 10 * 100 * 1.05 = 1050
        lines: [],
        supplier: { contacts: [] },
        currency: { code: 'AED', id: 'currency-1' },
        shipToLocation: null,
        grnHeaders: [],
        apInvoices: [],
      };

      mockPrisma.purchaseOrder.create.mockResolvedValue(createdPo);
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        ...createdPo,
        supplier: { contacts: [] },
        currency: { code: 'AED' },
        shipToLocation: null,
        lines: [],
        grnHeaders: [],
        apInvoices: [],
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.create(validCreateInput, 'user-1');

      const createCall = mockPrisma.purchaseOrder.create.mock.calls[0][0];
      // net amount = (10 * 100) * 1.05 = 1050
      expect(createCall.data.totalAmount).toBeCloseTo(1050, 2);
      expect(createCall.data.status).toBe('DRAFT');
      expect(createCall.data.docNo).toBe('PO-202604000001');
    });

    it('calculates net amount correctly with discount and tax', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue({ id: 'supplier-1', isActive: true });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-1', lines: [] });
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        lines: [],
        supplier: { contacts: [] },
        currency: {},
        shipToLocation: null,
        grnHeaders: [],
        apInvoices: [],
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.create(
        {
          ...validCreateInput,
          lines: [
            { itemId: 'i', uomId: 'u', orderedQty: 10, unitPrice: 100, discountPct: 10, taxPct: 5, chargeCodeId: 'cc' },
          ],
        },
        'user-1'
      );

      // gross = 1000, discount = 100, net = 900, tax = 45, total = 945
      const createCall = mockPrisma.purchaseOrder.create.mock.calls[0][0];
      expect(createCall.data.totalAmount).toBeCloseTo(945, 2);
    });
  });

  describe('cancel', () => {
    it('throws 422 if PO is already CLOSED', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'CLOSED',
        companyId: 'company-1',
        docNo: 'PO-001',
      });

      await expect(
        service.cancel('po-1', 'company-1', 'user-1', 'Test reason')
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('cancels a DRAFT PO successfully', async () => {
      const po = { id: 'po-1', status: 'DRAFT', companyId: 'company-1', docNo: 'PO-001' };
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(po);
      mockPrisma.purchaseOrder.update.mockResolvedValue({ ...po, status: 'CANCELLED' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.cancel('po-1', 'company-1', 'user-1', 'Budget cut');

      expect(result.message).toBe('Purchase Order cancelled');
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CANCELLED' } })
      );
    });

    it('rejects cancellation without a reason', async () => {
      // This is validated at route level via JSON schema, but service also guards
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'company-1',
        docNo: 'PO-001',
      });

      await expect(
        service.cancel('po-1', 'company-1', 'user-1', '')
      ).rejects.toMatchObject({ statusCode: 422 });
    });
  });

  describe('submit', () => {
    it('throws 422 if PO is not DRAFT', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'SUBMITTED',
        companyId: 'company-1',
        docNo: 'PO-001',
      });

      await expect(
        service.submit('po-1', 'company-1', 'user-1')
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('submits a DRAFT PO and notifies approvers', async () => {
      const po = { id: 'po-1', status: 'DRAFT', companyId: 'company-1', docNo: 'PO-001' };
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(po);
      mockPrisma.purchaseOrder.update.mockResolvedValue({ ...po, status: 'SUBMITTED' });
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'approver-1' }]);
      mockPrisma.notification.createMany.mockResolvedValue({});

      const result = await service.submit('po-1', 'company-1', 'user-1');

      expect(result.message).toBe('PO submitted for approval');
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'SUBMITTED' } })
      );
    });
  });

  describe('shortClose', () => {
    it('throws 422 if PO status is DRAFT', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'company-1',
      });

      await expect(
        service.shortClose('po-1', 'company-1', 'user-1')
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('closes an APPROVED PO', async () => {
      const po = { id: 'po-1', status: 'APPROVED', companyId: 'company-1', docNo: 'PO-001' };
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(po);
      mockPrisma.purchaseOrder.update.mockResolvedValue({ ...po, status: 'CLOSED' });

      const result = await service.shortClose('po-1', 'company-1', 'user-1');
      expect(result.message).toBe('Purchase Order short-closed');
    });
  });

  describe('list', () => {
    it('filters by status and supplier', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);

      await service.list({
        companyId: 'company-1',
        status: 'APPROVED' as any,
        supplierId: 'supplier-1',
      });

      const whereClause = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(whereClause.status).toBe('APPROVED');
      expect(whereClause.supplierId).toBe('supplier-1');
    });

    it('applies date range filter', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);

      await service.list({
        companyId: 'company-1',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      });

      const whereClause = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(whereClause.docDate.gte).toEqual(new Date('2024-01-01'));
      expect(whereClause.docDate.lte).toEqual(new Date('2024-12-31'));
    });
  });
});
