# Prompt 1: SALES DATA MODEL, SHARED TYPES, CONFIG & DOC NUMBERING

## Context — what has been built so far

The CloudERP platform is fully built with Procurement, Inventory, and Finance modules. The Prisma schema already contains core, procurement, inventory, and finance models, including a minimal `Customer` model (id, companyId, code, name, isActive) and `ArInvoice`, `StockMovement`, `GlAccount`, `AccountMapping`, `DocSequence`, and `WorkflowConfig`.
You are now beginning the Sales module. This first prompt establishes only the data model, shared types, configuration, and document numbering — no business logic yet.

## TASK — copy everything below to Claude

```
You are extending an existing CloudERP monorepo (React + TypeScript + Fastify + Prisma 5 + PostgreSQL). Build the DATA FOUNDATION for a new Sales module. Do NOT recreate existing models or services — reuse them. Follow the exact conventions already in `packages/backend/prisma/schema.prisma` (cuid ids, companyId scoping, `docNo` with `@@unique([companyId, docNo])`, `Decimal(18,3)` money, `Decimal(18,6)` rates/qty where used, status enums, createdById + timestamps, `@@map` snake_case tables).

1. EXTEND THE CUSTOMER MODEL (additively, keep existing fields):
- Add: type (enum CustomerType: COMPANY, INDIVIDUAL, GOVERNMENT), tradeName, trn (tax reg no), defaultTaxCodeId, isTaxExempt, paymentTerms, creditLimit Decimal(18,3), creditHold Boolean, priceListId, salespersonId (User), categoryId, notes.
- New models: CustomerContact (customerId, name, role, email, phone, isPrimary), CustomerAddress (customerId, type enum BILL_TO/SHIP_TO, line1, line2, city, country, isDefault), CustomerCategory (companyId, code, name).

2. PRICE LISTS:
- PriceList (companyId, name, currencyId, validFrom, validTo, isActive, isDefault).
- PriceListItem (priceListId, itemId, uomId, unitPrice Decimal(18,3), minPrice Decimal(18,3), validFrom, validTo).

3. SALES TRANSACTION MODELS (headers + line children, all companyId-scoped with docNo):
- SalesEnquiry / SalesEnquiryLine (status enum: OPEN, QUOTED, WON, LOST, CLOSED).
- SalesQuotation / SalesQuotationLine (rev Int, validTo, status: DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED; line: itemId, description, uomId, qty, unitPrice, discount, taxCodeId, netAmount).
- SalesOrder / SalesOrderLine (orderType enum: STOCK, SERVICE, PROJECT, DIRECT; header: customerId, orderDate, requestedDate, shipToAddressId, billToAddressId, salespersonId, paymentTerms, warehouseId, quotationId?, contractId?, status enum: DRAFT, PENDING_APPROVAL, APPROVED, CREDIT_HOLD, IN_PROGRESS, DELIVERED, CLOSED, CANCELLED, totalAmount; line: itemId, description, uomId, orderedQty, deliveredQty, invoicedQty, unitPrice, discount, taxCodeId, netAmount, requestedDate).
- DeliveryNote / DeliveryNoteLine (customerId, deliveryDate, shipToAddressId, warehouseId, salesOrderId, vehicleNo, driver, status enum: DRAFT, DISPATCHED, DELIVERED; line: salesOrderLineId, itemId, deliveredQty, uomId, binId?, unitCost).
- SalesInvoice / SalesInvoiceLine (customerId, deliveryNoteId?, salesOrderId?, invoiceDate, dueDate, amount, taxAmount, totalAmount, paidAmount, status enum: DRAFT, POSTED, PARTIALLY_PAID, PAID, CANCELLED, journalId?, arInvoiceId?; line: itemId, description, uomId, qty, unitPrice, discount, taxCodeId, netAmount, taxAmount, lineTotal).
- SalesReturn / SalesReturnLine (salesInvoiceId?, deliveryNoteId?, reason, status enum: DRAFT, APPROVED, RECEIVED, CLOSED; line: itemId, qty, uomId).
- CreditNote / CreditNoteLine (customerId, salesReturnId?, reason, amount, taxAmount, totalAmount, status enum: DRAFT, APPROVED, POSTED, APPLIED, CANCELLED, journalId?; line as invoice line).
- SalesContract (customerId, projectRef, contractValue, startDate, endDate, paymentTerms, costCenterId?, status).
- BoqLine (contractId, section, subSection, itemDescription, uomId, contractQty, rate, contractAmount).
- ProgressBill / ProgressBillLine (contractId, period, billDate, status enum: DRAFT, SUBMITTED, CERTIFIED, POSTED, amount, taxAmount, totalAmount, journalId?, arInvoiceId?; line: boqLineId, cumQty, cumValue, previousValue, thisValue).
- Add a TaxCode model if one does not already exist (companyId, code, rate Decimal(18,6), glAccountId for VAT output, isActive).

4. RELATIONS: wire foreign keys and back-relations to existing Customer, Item, Uom, Warehouse, Bin, Currency, GlAccount, CostCenter, User, ArInvoice, JournalEntry, StockMovement. Add indexes on ([companyId, status]) and customerId for each header.

5. SHARED TYPES: in `packages/shared`, add TypeScript types/DTOs and enums for every model above (mirroring how procurement/finance types are defined), plus request/response DTOs for create/update.

6. CONFIG & NUMBERING:
- Add sales configuration parameters (module toggle + CREDIT_CHECK_MODE, RESERVE_STOCK_ON_ORDER, ALLOW_NEGATIVE_STOCK, SO_APPROVAL_REQUIRED, DEFAULT_TAX_CODE, AUTO_POST_INVOICE, PRICE_OVERRIDE_ALLOWED) using the existing module-config mechanism.
- Register DocSequence prefixes: SEL, SQL, SOL, DNL, SVL, SRN, CRN, SCL, PBL.

7. Create the Prisma migration and extend the seed script with: 3 sample customers (with contacts, addresses, credit limits), 1 default price list with items, and sample tax codes (VAT 5%, Zero-rated, Exempt).

Deliver: updated schema.prisma, migration, shared types, config additions, seed updates. Do not build routes/services yet.
```

## Notes

- Run `prisma migrate dev` after reviewing the schema. If `Customer` already has relations from Finance, extend rather than replace them.
- Confirm the exact enum/status names here — later prompts reference them verbatim.
- Keep all money at Decimal(18,3) to match ArInvoice.
