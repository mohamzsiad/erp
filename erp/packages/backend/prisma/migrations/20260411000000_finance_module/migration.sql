-- Finance Module Migration
-- Adds: Customer, PeriodClose, AccountMapping, ApAllocation, ArAllocation
-- Extends: ApInvoice, ApPayment, ArInvoice, ArReceipt with new fields
-- Adds relations: Budget->GlAccount, GlAccount->AccountMappings

-- ── Customer ─────────────────────────────────────────────────────────────────
CREATE TABLE "customers" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code"      VARCHAR(20) NOT NULL,
  "name"      VARCHAR(200) NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customers_companyId_code_key" ON "customers"("companyId", "code");
ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── PeriodClose ───────────────────────────────────────────────────────────────
CREATE TABLE "period_closes" (
  "id"           TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "periodYear"   INTEGER NOT NULL,
  "periodMonth"  INTEGER NOT NULL,
  "closedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedById"   TEXT NOT NULL,
  "reopenedAt"   TIMESTAMP(3),
  "reopenedById" TEXT,
  CONSTRAINT "period_closes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "period_closes_companyId_periodYear_periodMonth_key"
  ON "period_closes"("companyId", "periodYear", "periodMonth");
ALTER TABLE "period_closes" ADD CONSTRAINT "period_closes_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── AccountMapping ────────────────────────────────────────────────────────────
CREATE TABLE "account_mappings" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "mappingType" VARCHAR(50) NOT NULL,
  "refId"       VARCHAR(50),
  "accountId"   TEXT NOT NULL,
  CONSTRAINT "account_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "account_mappings_companyId_mappingType_refId_key"
  ON "account_mappings"("companyId", "mappingType", "refId");
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── ApInvoice — new columns ───────────────────────────────────────────────────
ALTER TABLE "ap_invoices"
  ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "matchFlag"  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "journalId"  TEXT;

-- ── ApPayment — new columns ───────────────────────────────────────────────────
ALTER TABLE "ap_payments"
  ADD COLUMN IF NOT EXISTS "journalId" TEXT;

-- ── ApAllocation ──────────────────────────────────────────────────────────────
CREATE TABLE "ap_allocations" (
  "id"          TEXT NOT NULL,
  "paymentId"   TEXT NOT NULL,
  "invoiceId"   TEXT NOT NULL,
  "amount"      DECIMAL(18,3) NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ap_allocations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ap_allocations" ADD CONSTRAINT "ap_allocations_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "ap_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ap_allocations" ADD CONSTRAINT "ap_allocations_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "ap_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── ArInvoice — new columns + Customer FK ────────────────────────────────────
ALTER TABLE "ar_invoices"
  ADD COLUMN IF NOT EXISTS "description" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "paidAmount"  DECIMAL(18,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "journalId"   TEXT;

-- Add customer FK (only if column exists without FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'ar_invoices' AND constraint_name = 'ar_invoices_customerId_fkey'
  ) THEN
    ALTER TABLE "ar_invoices" ADD CONSTRAINT "ar_invoices_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── ArReceipt — new columns + Customer FK ────────────────────────────────────
ALTER TABLE "ar_receipts"
  ADD COLUMN IF NOT EXISTS "journalId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'ar_receipts' AND constraint_name = 'ar_receipts_customerId_fkey'
  ) THEN
    ALTER TABLE "ar_receipts" ADD CONSTRAINT "ar_receipts_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── ArAllocation ──────────────────────────────────────────────────────────────
CREATE TABLE "ar_allocations" (
  "id"          TEXT NOT NULL,
  "receiptId"   TEXT NOT NULL,
  "invoiceId"   TEXT NOT NULL,
  "amount"      DECIMAL(18,3) NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ar_allocations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ar_allocations" ADD CONSTRAINT "ar_allocations_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "ar_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ar_allocations" ADD CONSTRAINT "ar_allocations_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "ar_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Budget — accountId FK (was missing) ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'budgets' AND constraint_name = 'budgets_accountId_fkey'
  ) THEN
    ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
    ALTER TABLE "budgets" ADD CONSTRAINT "budgets_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
