-- CreateEnum
CREATE TYPE "PriceListType" AS ENUM ('STANDARD', 'CUSTOMER_SPECIFIC');

-- CreateEnum
CREATE TYPE "SalesmanType" AS ENUM ('SALESMAN', 'SUPERVISOR', 'VAN_SALESMAN', 'MANAGER');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('NORMAL', 'ADVANCE', 'CASH_ON_DELIVERY', 'CREDIT');

-- CreateEnum
CREATE TYPE "DueDateBasis" AS ENUM ('DOCUMENT_DATE', 'DELIVERY_DATE', 'MONTH_END', 'INVOICE_DATE');

-- AlterTable
ALTER TABLE "customer_addresses" ADD COLUMN     "contactPerson" VARCHAR(150),
ADD COLUMN     "crNo" VARCHAR(50),
ADD COLUMN     "email" VARCHAR(150),
ADD COLUMN     "fax" VARCHAR(50),
ADD COLUMN     "line3" VARCHAR(200),
ADD COLUMN     "line4" VARCHAR(200),
ADD COLUMN     "line5" VARCHAR(200),
ADD COLUMN     "mobile" VARCHAR(50),
ADD COLUMN     "name" VARCHAR(200),
ADD COLUMN     "phone" VARCHAR(50),
ADD COLUMN     "postalCode" VARCHAR(20),
ADD COLUMN     "taxCardNo" VARCHAR(50),
ADD COLUMN     "vatNo" VARCHAR(50);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "currencyId" TEXT,
ADD COLUMN     "paymentTermId" TEXT,
ADD COLUMN     "salesmanId" TEXT;

-- AlterTable
ALTER TABLE "price_lists" ADD COLUMN     "code" VARCHAR(20),
ADD COLUMN     "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
ADD COLUMN     "ownerCustomerId" TEXT,
ADD COLUMN     "type" "PriceListType" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "sales_order_lines" ADD COLUMN     "reserveUntil" DATE,
ADD COLUMN     "reserveWarehouseId" TEXT,
ADD COLUMN     "reservedQty" DECIMAL(18,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "currencyId" TEXT,
ADD COLUMN     "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "paymentTermId" TEXT,
ADD COLUMN     "salesmanId" TEXT;

-- CreateTable
CREATE TABLE "salesmen" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "shortName" VARCHAR(150),
    "type" "SalesmanType" NOT NULL DEFAULT 'SALESMAN',
    "minMarkupPct" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "maxVariancePct" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "relatedSalesmanId" TEXT,
    "contactNumber" VARCHAR(50),
    "email" VARCHAR(150),
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salesmen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_terms" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "shortName" VARCHAR(100),
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'NORMAL',
    "dueDateBasis" "DueDateBasis" NOT NULL DEFAULT 'DOCUMENT_DATE',
    "dueDateAfterAdvance" BOOLEAN NOT NULL DEFAULT false,
    "creditDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_term_lines" (
    "id" TEXT NOT NULL,
    "paymentTermId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "paymentPct" DECIMAL(9,4) NOT NULL,
    "addMonths" INTEGER NOT NULL DEFAULT 0,
    "creditDays" INTEGER NOT NULL DEFAULT 0,
    "cashDiscountDays" INTEGER,
    "cashDiscountPct" DECIMAL(9,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_term_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_companies" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salesmanId" TEXT,
    "priceListId" TEXT,
    "paymentTermId" TEXT,
    "creditLimit" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "creditExposureLimit" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "closeToExpiryDays" INTEGER,
    "isBlackListed" BOOLEAN NOT NULL DEFAULT false,
    "isGreyListed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salesmen_companyId_isActive_idx" ON "salesmen"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "salesmen_companyId_code_key" ON "salesmen"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "payment_terms_companyId_code_key" ON "payment_terms"("companyId", "code");

-- CreateIndex
CREATE INDEX "payment_term_lines_paymentTermId_idx" ON "payment_term_lines"("paymentTermId");

-- CreateIndex
CREATE INDEX "customer_companies_companyId_idx" ON "customer_companies"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_companies_customerId_companyId_key" ON "customer_companies"("customerId", "companyId");

-- CreateIndex
CREATE INDEX "price_lists_companyId_type_idx" ON "price_lists"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_ownerCustomerId_key" ON "price_lists"("ownerCustomerId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_paymentTermId_fkey" FOREIGN KEY ("paymentTermId") REFERENCES "payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesmen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salesmen" ADD CONSTRAINT "salesmen_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salesmen" ADD CONSTRAINT "salesmen_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salesmen" ADD CONSTRAINT "salesmen_relatedSalesmanId_fkey" FOREIGN KEY ("relatedSalesmanId") REFERENCES "salesmen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_terms" ADD CONSTRAINT "payment_terms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_term_lines" ADD CONSTRAINT "payment_term_lines_paymentTermId_fkey" FOREIGN KEY ("paymentTermId") REFERENCES "payment_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_companies" ADD CONSTRAINT "customer_companies_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_companies" ADD CONSTRAINT "customer_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_companies" ADD CONSTRAINT "customer_companies_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesmen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_companies" ADD CONSTRAINT "customer_companies_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_companies" ADD CONSTRAINT "customer_companies_paymentTermId_fkey" FOREIGN KEY ("paymentTermId") REFERENCES "payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesmen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_paymentTermId_fkey" FOREIGN KEY ("paymentTermId") REFERENCES "payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_reserveWarehouseId_fkey" FOREIGN KEY ("reserveWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

