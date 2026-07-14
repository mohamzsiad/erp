# Prompt 8: SALES INVOICE — AUTO-POST TO AR + GL WITH VAT

## Context — what has been built so far

Deliveries reduce stock and flag delivered lines ready to invoice (Prompt 7). Finance provides ArInvoice, JournalEntry/JournalLine, GlAccount, and the AccountMapping mechanism (used by AP for automatic posting).
Build the Sales Invoice, which is where Sales integrates with Finance.

## TASK — copy everything below to Claude

```
Build the SALES INVOICE end to end with automatic AR + GL posting, mirroring how AP invoices post.

BACKEND (SalesInvoiceService):
- Create from a Delivery Note (deliver-then-bill), directly from a Sales Order (bill-before-deliver), or standalone/service invoice.
- Line pricing/tax via SalesPricingService; compute per-line VAT from taxCode, tax summary by rate, dueDate from payment terms.
- post(invoiceId) inside a DB transaction, when AUTO_POST_INVOICE is true:
1. Create an ArInvoice (customer, docNo, invoiceDate, dueDate, amount, taxAmount, totalAmount, links).
2. Create a JournalEntry via AccountMapping: Dr Accounts Receivable, Cr Revenue, Cr VAT Output; and for stock lines Dr COGS, Cr Inventory using the captured delivery cost. Balance the journal and store journalId + arInvoiceId on the invoice.
3. Update SalesOrderLine.invoicedQty and order status.
- Status DRAFT → POSTED → PARTIALLY_PAID → PAID (driven by AR receipts/allocations) → CANCELLED (reverses postings).
- Routes `/api/v1/sales/invoices` incl. /post and /cancel; RBAC, Swagger, audit. Tax-invoice PDF (TRN, sequential number, tax summary) + email.

FRONTEND: Invoices page — list with status/paid badges; form (from DN/SO or standalone) with line grid, tax summary, totals; Post/Cancel/Print/Send actions; link to AR receipts.

TESTS: journal balances to zero; correct accounts from mappings; VAT computed per rate; cancel reverses AR + GL; invoicedQty and status update. Deliver building green.
```

## Notes

- Reuse the AP posting/AccountMapping code path — do not invent a new journal poster.
- Confirm the revenue, receivable, VAT-output, COGS, and inventory account mappings exist in seed/config before posting.
- All sales documents are base-currency in this release — no FX conversion.
