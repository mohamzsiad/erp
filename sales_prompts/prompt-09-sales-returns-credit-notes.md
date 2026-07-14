# Prompt 9: SALES RETURNS & CREDIT NOTES

## Context — what has been built so far

Sales Invoices post to AR + GL (Prompt 8). You now need to handle goods coming back and credits issued to customers.
Build Sales Returns and Credit Notes.

## TASK — copy everything below to Claude

```
Build SALES RETURNS and CREDIT NOTES end to end.

SALES RETURN (SalesReturnService):
- Reference an invoice and/or delivery; capture reason and item condition; validate return qty ≤ delivered/invoiced.
- receive(returnId): post an INBOUND StockMovement (type SALES_RETURN) to bring stock back on-hand (at the original cost). Status DRAFT → APPROVED → RECEIVED → CLOSED.

CREDIT NOTE (CreditNoteService):
- Create linked to a return (goods) or standalone (price adjustment/allowance). Compute amount + VAT.
- Approval via WorkflowConfig above a configurable threshold.
- post(creditNoteId): create a negative/credit ArInvoice or AR credit and a reversing JournalEntry (Dr Revenue, Dr VAT Output, Cr Receivable; and for goods Dr Inventory, Cr COGS). Allocate against the original invoice where applicable. Status DRAFT → APPROVED → POSTED → APPLIED → CANCELLED.

Routes `/api/v1/sales/returns` and `/api/v1/sales/credit-notes` (incl. /approve, /receive, /post). RBAC, Swagger, audit. PDF for credit note.

FRONTEND: Returns and Credit Notes pages — list + forms pulling source invoice/delivery lines, approval + post actions, print.

TESTS: stock restored correctly; credit-note journal reverses the right accounts and balances; allocation reduces the original invoice's outstanding. Deliver building green.
```

## Notes

- Reverse exactly what the invoice posted — reuse the same AccountMapping keys.
- A credit note without a return (pure price allowance) must not touch stock.
