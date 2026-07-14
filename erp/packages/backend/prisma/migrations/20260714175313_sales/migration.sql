-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('COMPANY', 'INDIVIDUAL', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('BILL_TO', 'SHIP_TO');

-- CreateEnum
CREATE TYPE "SalesEnquiryStatus" AS ENUM ('OPEN', 'QUOTED', 'WON', 'LOST', 'CLOSED');

-- CreateEnum
CREATE TYPE "SalesQuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SalesOrderType" AS ENUM ('STOCK', 'SERVICE', 'PROJECT', 'DIRECT');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CREDIT_HOLD', 'IN_PROGRESS', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "SalesInvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesReturnStatus" AS ENUM ('DRAFT', 'APPROVED', 'RECEIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProgressBillStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CERTIFIED', 'POSTED');

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'SALES';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "salesConfig" JSONB;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "creditHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creditLimit" DECIMAL(18,3) NOT NULL DEFAULT 0,
ADD COLUMN     "defaultTaxCodeId" TEXT,
ADD COLUMN     "isTaxExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTerms" VARCHAR(100),
ADD COLUMN     "priceListId" TEXT,
ADD COLUMN     "salespersonId" TEXT,
ADD COLUMN     "tradeName" VARCHAR(200),
ADD COLUMN     "trn" VARCHAR(50),
ADD COLUMN     "type" "CustomerType" NOT NULL DEFAULT 'COMPANY';

-- CreateTable
CREATE TABLE "tax_codes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rate" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "vatOutputAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "customer_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "role" VARCHAR(100),
    "email" VARCHAR(150),
    "phone" VARCHAR(50),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "AddressType" NOT NULL,
    "line1" VARCHAR(200) NOT NULL,
    "line2" VARCHAR(200),
    "city" VARCHAR(100),
    "country" VARCHAR(100),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "currencyId" TEXT,
    "validFrom" DATE,
    "validTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,3) NOT NULL,
    "minPrice" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "validFrom" DATE,
    "validTo" DATE,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_enquiries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docNo" VARCHAR(30) NOT NULL,
    "customerId" TEXT,
    "prospectName" VARCHAR(200),
    "enquiryDate" DATE NOT NULL,
    "requiredByDate" DATE,
    "salespersonId" TEXT,
    "source" VARCHAR(100),
    "lostReason" VARCHAR(300),
    "notes" TEXT,
    "status" "SalesEnquiryStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_enquiry_lines" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" VARCHAR(300),
    "uomId" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "targetPrice" DECIMAL(18,3),
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "sales_enquiry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quotations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docNo" VARCHAR(30) NOT NULL,
    "customerId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "quotationDate" DATE NOT NULL,
    "validTo" DATE,
    "paymentTerms" VARCHAR(100),
    "salespersonId" TEXT,
    "status" "SalesQuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "subTotal" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quotation_lines" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" VARCHAR(300),
    "uomId" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,3) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "netAmount" DECIMAL(18,3) NOT NULL,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "sales_quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docNo" VARCHAR(30) NOT NULL,
    "customerId" TEXT NOT NULL,
    "quotationId" TEXT,
    "contractId" TEXT,
    "orderType" "SalesOrderType" NOT NULL DEFAULT 'STOCK',
    "orderDate" DATE NOT NULL,
    "requestedDate" DATE,
    "billToAddressId" TEXT,
    "shipToAddressId" TEXT,
    "salespersonId" TEXT,
    "paymentTerms" VARCHAR(100),
    "warehouseId" TEXT,
    "notes" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "creditHoldReason" VARCHAR(300),
    "subTotal" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" VARCHAR(300),
    "uomId" TEXT NOT NULL,
    "orderedQty" DECIMAL(18,3) NOT NULL,
    "deliveredQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "invoicedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,3) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "netAmount" DECIMAL(18,3) NOT NULL,
    "requestedDate" DATE,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_notes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docNo" VARCHAR(30) NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "deliveryDate" DATE NOT NULL,
    "shipToAddressId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "vehicleNo" VARCHAR(50),
    "driver" VARCHAR(100),
    "notes" TEXT,
    "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_note_lines" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "salesOrderLineId" TEXT,
    "itemId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "deliveredQty" DECIMAL(18,3) NOT NULL,
    "binId" TEXT,
    "unitCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "delivery_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docNo" VARCHAR(30) NOT NULL,
    "customerId" TEXT NOT NULL,
    "deliveryNoteId" TEXT,
    "salesOrderId" TEXT,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "description" VARCHAR(500),
    "subTotal" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "status" "SalesInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "journalId" TEXT,
    "arInvoiceId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" VARCHAR(300),
    "uomId" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,3) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "netAmount" DECIMAL(18,3) NOT NULL,
    "taxAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,3) NOT NULL,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docNo" VARCHAR(30) NOT NULL,
    "salesInvoiceId" TEXT,
    "deliveryNoteId" TEXT,
    "customerId" TEXT,
    "returnDate" DATE NOT NULL,
    "reason" VARCHAR(300),
    "status" "SalesReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_lines" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docNo" VARCHAR(30) NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesReturnId" TEXT,
    "creditDate" DATE NOT NULL,
    "reason" VARCHAR(300),
    "amount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "journalId" TEXT,
    "arInvoiceId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_lines" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" VARCHAR(300),
    "uomId" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,3) NOT NULL,
    "taxCodeId" TEXT,
    "netAmount" DECIMAL(18,3) NOT NULL,
    "taxAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,3) NOT NULL,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_contracts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docNo" VARCHAR(30) NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectRef" VARCHAR(100),
    "projectName" VARCHAR(200) NOT NULL,
    "contractValue" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "startDate" DATE,
    "endDate" DATE,
    "paymentTerms" VARCHAR(100),
    "costCenterId" TEXT,
    "status" "SalesContractStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boq_lines" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "section" VARCHAR(100),
    "subSection" VARCHAR(100),
    "itemDescription" VARCHAR(500) NOT NULL,
    "uomId" TEXT,
    "contractQty" DECIMAL(18,3) NOT NULL,
    "rate" DECIMAL(18,3) NOT NULL,
    "contractAmount" DECIMAL(18,3) NOT NULL,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "boq_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_bills" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docNo" VARCHAR(30) NOT NULL,
    "contractId" TEXT NOT NULL,
    "period" VARCHAR(50) NOT NULL,
    "billDate" DATE NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "status" "ProgressBillStatus" NOT NULL DEFAULT 'DRAFT',
    "journalId" TEXT,
    "arInvoiceId" TEXT,
    "certifiedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_bill_lines" (
    "id" TEXT NOT NULL,
    "progressBillId" TEXT NOT NULL,
    "boqLineId" TEXT NOT NULL,
    "cumQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "cumValue" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "previousValue" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "thisValue" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "progress_bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_companyId_code_key" ON "tax_codes"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customer_categories_companyId_code_key" ON "customer_categories"("companyId", "code");

-- CreateIndex
CREATE INDEX "customer_contacts_customerId_idx" ON "customer_contacts"("customerId");

-- CreateIndex
CREATE INDEX "customer_addresses_customerId_idx" ON "customer_addresses"("customerId");

-- CreateIndex
CREATE INDEX "price_list_items_itemId_idx" ON "price_list_items"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_items_priceListId_itemId_uomId_key" ON "price_list_items"("priceListId", "itemId", "uomId");

-- CreateIndex
CREATE INDEX "sales_enquiries_companyId_status_idx" ON "sales_enquiries"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_enquiries_companyId_docNo_key" ON "sales_enquiries"("companyId", "docNo");

-- CreateIndex
CREATE INDEX "sales_enquiry_lines_enquiryId_idx" ON "sales_enquiry_lines"("enquiryId");

-- CreateIndex
CREATE INDEX "sales_quotations_companyId_status_idx" ON "sales_quotations"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_quotations_companyId_docNo_key" ON "sales_quotations"("companyId", "docNo");

-- CreateIndex
CREATE INDEX "sales_quotation_lines_quotationId_idx" ON "sales_quotation_lines"("quotationId");

-- CreateIndex
CREATE INDEX "sales_orders_companyId_status_idx" ON "sales_orders"("companyId", "status");

-- CreateIndex
CREATE INDEX "sales_orders_customerId_idx" ON "sales_orders"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_companyId_docNo_key" ON "sales_orders"("companyId", "docNo");

-- CreateIndex
CREATE INDEX "sales_order_lines_orderId_idx" ON "sales_order_lines"("orderId");

-- CreateIndex
CREATE INDEX "delivery_notes_companyId_status_idx" ON "delivery_notes"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notes_companyId_docNo_key" ON "delivery_notes"("companyId", "docNo");

-- CreateIndex
CREATE INDEX "delivery_note_lines_deliveryNoteId_idx" ON "delivery_note_lines"("deliveryNoteId");

-- CreateIndex
CREATE INDEX "sales_invoices_companyId_status_idx" ON "sales_invoices"("companyId", "status");

-- CreateIndex
CREATE INDEX "sales_invoices_customerId_idx" ON "sales_invoices"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_companyId_docNo_key" ON "sales_invoices"("companyId", "docNo");

-- CreateIndex
CREATE INDEX "sales_invoice_lines_invoiceId_idx" ON "sales_invoice_lines"("invoiceId");

-- CreateIndex
CREATE INDEX "sales_returns_companyId_status_idx" ON "sales_returns"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_companyId_docNo_key" ON "sales_returns"("companyId", "docNo");

-- CreateIndex
CREATE INDEX "sales_return_lines_returnId_idx" ON "sales_return_lines"("returnId");

-- CreateIndex
CREATE INDEX "credit_notes_companyId_status_idx" ON "credit_notes"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_companyId_docNo_key" ON "credit_notes"("companyId", "docNo");

-- CreateIndex
CREATE INDEX "credit_note_lines_creditNoteId_idx" ON "credit_note_lines"("creditNoteId");

-- CreateIndex
CREATE INDEX "sales_contracts_companyId_status_idx" ON "sales_contracts"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_contracts_companyId_docNo_key" ON "sales_contracts"("companyId", "docNo");

-- CreateIndex
CREATE INDEX "boq_lines_contractId_idx" ON "boq_lines"("contractId");

-- CreateIndex
CREATE INDEX "progress_bills_companyId_status_idx" ON "progress_bills"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "progress_bills_companyId_docNo_key" ON "progress_bills"("companyId", "docNo");

-- CreateIndex
CREATE INDEX "progress_bill_lines_progressBillId_idx" ON "progress_bill_lines"("progressBillId");

-- CreateIndex
CREATE INDEX "customers_companyId_categoryId_idx" ON "customers"("companyId", "categoryId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "customer_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_defaultTaxCodeId_fkey" FOREIGN KEY ("defaultTaxCodeId") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_enquiries" ADD CONSTRAINT "sales_enquiries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_enquiry_lines" ADD CONSTRAINT "sales_enquiry_lines_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "sales_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_enquiry_lines" ADD CONSTRAINT "sales_enquiry_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_enquiry_lines" ADD CONSTRAINT "sales_enquiry_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "sales_enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "sales_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "sales_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "sales_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_lines" ADD CONSTRAINT "delivery_note_lines_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_lines" ADD CONSTRAINT "delivery_note_lines_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "sales_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_lines" ADD CONSTRAINT "delivery_note_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_lines" ADD CONSTRAINT "delivery_note_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_salesReturnId_fkey" FOREIGN KEY ("salesReturnId") REFERENCES "sales_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_lines" ADD CONSTRAINT "boq_lines_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "sales_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_lines" ADD CONSTRAINT "boq_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_bills" ADD CONSTRAINT "progress_bills_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "sales_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_bill_lines" ADD CONSTRAINT "progress_bill_lines_progressBillId_fkey" FOREIGN KEY ("progressBillId") REFERENCES "progress_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_bill_lines" ADD CONSTRAINT "progress_bill_lines_boqLineId_fkey" FOREIGN KEY ("boqLineId") REFERENCES "boq_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
