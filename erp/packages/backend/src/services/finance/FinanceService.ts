/**
 * FinanceService — Auto-posting integration layer.
 *
 * Called by inventory and procurement services to post
 * journals for GRN receipts, invoice matching, and stock issues.
 */
import { PrismaClient } from '@prisma/client';
import { JournalService } from './JournalService.js';
import { AccountMappingService } from './AccountMappingService.js';

export class FinanceService {
  private journal: JournalService;
  private mapping: AccountMappingService;

  constructor(private prisma: PrismaClient) {
    this.journal = new JournalService(prisma);
    this.mapping = new AccountMappingService(prisma);
  }

  // ── Helper: check if FINANCE module is enabled ─────────────────────────────
  private async financeEnabled(companyId: string): Promise<boolean> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { modulesEnabled: true },
    });
    return (company?.modulesEnabled as string[] ?? []).includes('FINANCE');
  }

  // ── GRN Journal: DR Inventory Account / CR GRN Clearing ───────────────────
  // Called when a GRN is posted. Amount = acceptedQty × PO unit price per line.
  async postGrnJournal(grnId: string, companyId: string, userId: string): Promise<void> {
    if (!await this.financeEnabled(companyId)) return;

    const grn = await this.prisma.grnHeader.findFirst({
      where: { id: grnId, companyId },
      include: {
        lines: {
          include: {
            item: { select: { itemCategoryId: true } },
            poLine: { select: { unitPrice: true } },
          },
        },
      },
    });
    if (!grn) return;

    // Group by item category to use per-category GL mapping
    const linesByCategory = new Map<string, { totalValue: number; categoryId: string }>();
    for (const line of (grn as any).lines ?? []) {
      const categoryId = line.item?.itemCategoryId ?? '__default__';
      const price      = Number(line.poLine?.unitPrice ?? 0);
      const qty        = Number(line.acceptedQty ?? 0);
      const value      = qty * price;
      if (value <= 0) continue;

      const existing = linesByCategory.get(categoryId) ?? { totalValue: 0, categoryId };
      existing.totalValue += value;
      linesByCategory.set(categoryId, existing);
    }

    if (linesByCategory.size === 0) return;

    const clearingAccId = await this.mapping.tryResolve(companyId, 'GRN_CLEARING');
    if (!clearingAccId) return; // Mapping not configured yet — skip silently

    const journalLines: { accountId: string; debit: number; credit: number; description: string }[] = [];

    for (const { categoryId, totalValue } of linesByCategory.values()) {
      const inventoryAccId = await this.mapping.tryResolve(
        companyId, 'INVENTORY_ACCOUNT', categoryId === '__default__' ? undefined : categoryId
      );
      if (!inventoryAccId) continue;

      journalLines.push(
        { accountId: inventoryAccId, debit: totalValue, credit: 0, description: `Inventory receipt: ${(grn as any).docNo}` },
        { accountId: clearingAccId,  debit: 0, credit: totalValue, description: `GRN clearing: ${(grn as any).docNo}` }
      );
    }

    if (journalLines.length === 0) return;

    await this.journal.postJournal({
      companyId,
      entryDate:   new Date((grn as any).docDate),
      description: `GRN posting: ${(grn as any).docNo}`,
      lines:       journalLines,
      sourceModule: 'INVENTORY',
      sourceDocId:  grnId,
      userId,
    });
  }

  // ── Invoice Match Journal: DR GRN Clearing / CR Supplier Control ──────────
  // Called when an AP Invoice successfully matches a GRN.
  async postInvoiceMatchJournal(apInvoiceId: string, companyId: string, userId: string): Promise<void> {
    if (!await this.financeEnabled(companyId)) return;

    const inv = await this.prisma.apInvoice.findFirst({ where: { id: apInvoiceId, companyId } });
    if (!inv) return;

    const clearingAccId      = await this.mapping.tryResolve(companyId, 'GRN_CLEARING');
    const supplierControlAcc = await this.mapping.tryResolve(companyId, 'SUPPLIER_CONTROL');
    if (!clearingAccId || !supplierControlAcc) return;

    const amount = Number(inv.totalAmount);

    await this.journal.postJournal({
      companyId,
      entryDate:   new Date((inv as any).invoiceDate),
      description: `Invoice match: ${(inv as any).docNo}`,
      lines: [
        { accountId: clearingAccId,      debit: amount, credit: 0,      description: `Clear GRN accrual: ${(inv as any).docNo}` },
        { accountId: supplierControlAcc, debit: 0,      credit: amount, description: `Supplier payable: ${(inv as any).docNo}` },
      ],
      sourceModule: 'AP',
      sourceDocId:  apInvoiceId,
      userId,
    });
  }

  // ── Stock Issue Journal: DR Cost Center Expense / CR Inventory ────────────
  // Called when a stock issue is posted. Amount = issuedQty × avg cost.
  async postStockIssueJournal(issueId: string, companyId: string, userId: string): Promise<void> {
    if (!await this.financeEnabled(companyId)) return;

    const issue = await this.prisma.stockIssue.findFirst({
      where: { id: issueId, companyId },
      include: {
        lines: {
          include: {
            item: {
              include: {
                category: { select: { id: true } },
                stockBalances: { select: { qtyOnHand: true, totalCost: true } },
              },
            },
          },
        },
        chargeCode: { select: { id: true, costCenterId: true } },
      },
    });
    if (!issue) return;

    const journalLines: Array<{
      accountId: string; costCenterId?: string; debit: number; credit: number; description: string;
    }> = [];

    for (const line of (issue as any).lines ?? []) {
      const item         = line.item;
      const categoryId   = item?.category?.id;
      const issuedQty    = Number(line.issuedQty ?? 0);

      // Calculate avg cost from stock balance
      const sb           = item?.stockBalances?.[0];
      const totalCost    = Number(sb?.totalCost   ?? 0);
      const qtyOnHand    = Number(sb?.qtyOnHand   ?? 1);
      const avgCost      = totalCost > 0 ? totalCost / qtyOnHand : 0;
      const lineValue    = issuedQty * avgCost;
      if (lineValue <= 0) continue;

      const inventoryAccId = await this.mapping.tryResolve(
        companyId, 'INVENTORY_ACCOUNT', categoryId
      );
      const expenseAccId = await this.mapping.tryResolve(companyId, 'AP_EXPENSE');
      if (!inventoryAccId || !expenseAccId) continue;

      const costCenterId = (issue as any).chargeCode?.costCenterId ?? undefined;

      journalLines.push(
        { accountId: expenseAccId,   costCenterId, debit: lineValue, credit: 0,         description: `Issue: ${item.code}` },
        { accountId: inventoryAccId,              debit: 0,          credit: lineValue, description: `Inventory credit: ${item.code}` }
      );
    }

    if (journalLines.length === 0) return;

    await this.journal.postJournal({
      companyId,
      entryDate:   new Date((issue as any).issueDate),
      description: `Stock issue: ${(issue as any).docNo}`,
      lines:       journalLines,
      sourceModule: 'INVENTORY',
      sourceDocId:  issueId,
      userId,
    });
  }
}
