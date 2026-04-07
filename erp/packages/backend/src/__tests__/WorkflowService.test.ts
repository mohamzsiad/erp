import { WorkflowService } from '../services/WorkflowService';
import type { WorkflowLevel } from '@clouderp/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPrisma = {
  workflowConfig: {
    findUnique: jest.fn(),
  },
  materialRequisition: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  purchaseRequisition: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  purchaseOrder: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    createMany: jest.fn(),
  },
  mrlLine: {
    update: jest.fn(),
  },
  prlLine: {
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  workflowConfig_findMany: jest.fn(),
};

// Also expose findMany on workflowConfig
(mockPrisma as any).workflowConfig.findMany = jest.fn();

jest.mock('../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    notifyRequestor: jest.fn().mockResolvedValue(undefined),
    createNotifications: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('WorkflowService', () => {
  let service: WorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkflowService(mockPrisma as any);
  });

  // ── resolveRequiredLevel (private — tested indirectly via processApproval) ──

  describe('processApproval', () => {
    const baseDoc = {
      status: 'SUBMITTED',
      companyId: 'company-1',
      docNo: 'MRL-202604001',
      createdById: 'user-requester',
    };

    it('rejects a document not in SUBMITTED status', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue({
        ...baseDoc,
        status: 'DRAFT',
      });

      await expect(
        service.processApproval({
          docType: 'MRL',
          docId: 'mrl-1',
          userId: 'user-approver',
          action: 'approve',
        })
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('approves a single-level MRL with no workflow config', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(baseDoc);
      mockPrisma.workflowConfig.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'APPROVED' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.processApproval({
        docType: 'MRL',
        docId: 'mrl-1',
        userId: 'user-approver',
        action: 'approve',
      });

      expect(result.status).toBe('APPROVED');
      expect(mockPrisma.materialRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) })
      );
    });

    it('rejects a document and sets status to REJECTED', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(baseDoc);
      mockPrisma.workflowConfig.findUnique.mockResolvedValue(null);
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'REJECTED' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.processApproval({
        docType: 'MRL',
        docId: 'mrl-1',
        userId: 'user-approver',
        action: 'reject',
        comment: 'Not enough budget',
      });

      expect(result.status).toBe('REJECTED');
    });

    it('stays SUBMITTED when multi-level approval not yet met', async () => {
      const twoLevelConfig = {
        levels: [
          { level: 1, approverRole: 'role-manager', minAmount: 0, maxAmount: 10000 },
          { level: 2, approverRole: 'role-director', minAmount: 10000, maxAmount: null },
        ] as WorkflowLevel[],
      };

      mockPrisma.materialRequisition.findUnique.mockResolvedValue(baseDoc);
      mockPrisma.workflowConfig.findUnique.mockResolvedValue(twoLevelConfig);
      // Simulate amount > 10000 — routes to level 2
      mockPrisma.auditLog.count.mockResolvedValue(0); // 0 prior approvals
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'SUBMITTED' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.processApproval({
        docType: 'MRL',
        docId: 'mrl-1',
        userId: 'user-manager',
        action: 'approve',
        totalAmount: 15000, // > 10000 → level 2 required
      });

      expect(result.status).toBe('SUBMITTED'); // still needs level 2
    });

    it('applies line adjustments on MRL approval', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(baseDoc);
      mockPrisma.workflowConfig.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'APPROVED' });
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.mrlLine.update.mockResolvedValue({});

      await service.processApproval({
        docType: 'MRL',
        docId: 'mrl-1',
        userId: 'user-approver',
        action: 'approve',
        lineAdjustments: [{ lineId: 'line-1', approvedQty: 5 }],
      });

      expect(mockPrisma.mrlLine.update).toHaveBeenCalledWith({
        where: { id: 'line-1' },
        data: { approvedQty: 5 },
      });
    });
  });

  describe('getApprovalStatus', () => {
    it('returns only approval-related audit log entries', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          userId: 'user-1',
          createdAt: new Date('2024-04-01'),
          user: { firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
          newValues: { action: 'approve', status: 'APPROVED', comment: 'OK' },
        },
        {
          id: 'log-2',
          userId: 'user-2',
          createdAt: new Date('2024-04-01'),
          user: { firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' },
          newValues: { status: 'DRAFT' }, // not an approval action
        },
      ]);

      const result = await service.getApprovalStatus('MRL', 'mrl-1');
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('approve');
      expect(result[0].approvedBy).toBe('John Doe');
    });
  });
});
