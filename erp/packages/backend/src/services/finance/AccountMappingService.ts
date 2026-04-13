import { PrismaClient } from '@prisma/client';

export type MappingType =
  | 'INVENTORY_ACCOUNT'
  | 'SUPPLIER_CONTROL'
  | 'CUSTOMER_CONTROL'
  | 'GRN_CLEARING'
  | 'BANK_ACCOUNT'
  | 'AP_EXPENSE'
  | 'AR_REVENUE';

export class AccountMappingService {
  constructor(private prisma: PrismaClient) {}

  // ── Resolve a single mapping (throws if not found) ─────────────────────────
  async resolve(companyId: string, mappingType: MappingType, refId?: string): Promise<string> {
    // Try specific refId first, then fall back to the catch-all (null refId)
    const mapping = await this.prisma.accountMapping.findFirst({
      where: {
        companyId,
        mappingType,
        refId: refId ?? null,
      },
    });
    if (mapping) return mapping.accountId;

    if (refId) {
      // Fall back to catch-all
      const fallback = await this.prisma.accountMapping.findFirst({
        where: { companyId, mappingType, refId: null },
      });
      if (fallback) return fallback.accountId;
    }

    throw Object.assign(
      new Error(`Account mapping not configured: ${mappingType}${refId ? ` (refId: ${refId})` : ''}`),
      { statusCode: 422 }
    );
  }

  // ── Try-resolve (returns null instead of throwing) ─────────────────────────
  async tryResolve(companyId: string, mappingType: MappingType, refId?: string): Promise<string | null> {
    try {
      return await this.resolve(companyId, mappingType, refId);
    } catch {
      return null;
    }
  }

  // ── List all mappings ──────────────────────────────────────────────────────
  async list(companyId: string) {
    return this.prisma.accountMapping.findMany({
      where: { companyId },
      include: { account: { select: { code: true, name: true, accountType: true } } },
      orderBy: [{ mappingType: 'asc' }, { refId: 'asc' }],
    });
  }

  // ── Upsert mapping ─────────────────────────────────────────────────────────
  async upsert(companyId: string, mappingType: string, accountId: string, refId?: string) {
    const account = await this.prisma.glAccount.findFirst({ where: { id: accountId, companyId } });
    if (!account) throw Object.assign(new Error('GL Account not found'), { statusCode: 404 });

    return this.prisma.accountMapping.upsert({
      where: {
        companyId_mappingType_refId: {
          companyId,
          mappingType,
          refId: refId ?? null,
        },
      },
      create: { companyId, mappingType, accountId, refId: refId ?? null },
      update: { accountId },
      include: { account: { select: { code: true, name: true } } },
    });
  }

  // ── Delete mapping ─────────────────────────────────────────────────────────
  async delete(id: string, companyId: string) {
    const mapping = await this.prisma.accountMapping.findFirst({ where: { id, companyId } });
    if (!mapping) throw Object.assign(new Error('Mapping not found'), { statusCode: 404 });
    return this.prisma.accountMapping.delete({ where: { id } });
  }
}
