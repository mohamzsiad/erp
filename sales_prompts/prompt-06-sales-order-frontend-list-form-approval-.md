# Prompt 6: SALES ORDER — FRONTEND (LIST, FORM, APPROVAL, CREDIT & STOCK UI)

## Context — what has been built so far

The Sales Order backend is complete with confirm/approve/credit-hold/reservation and an availability endpoint (Prompt 5).
Build the Sales Order frontend.

## TASK — copy everything below to Claude

```
Build the SALES ORDER FRONTEND under the Sales nav, matching the Purchase Order screen's design.

- Order list: ag-grid with paging/filtering by status, customer, salesperson, date; status and credit-hold badges; totals.
- Order form: header panel (customer, dates, addresses via customer's saved addresses, salesperson, warehouse, payment terms, linked quotation) + editable line grid (item picker, qty, resolved unit price with override + min-price warning, discount, tax code, net) + totals footer (sub-total, discount, tax, grand total).
- Inline Available-to-Promise indicator per line (calls /availability); highlight lines with insufficient stock.
- Action bar: Save Draft, Confirm (triggers credit check + approval), Approve/Reject (for approvers), Release Credit Hold (Credit Controller), Short-Close, Cancel, Print. Reflect returned status/credit-hold and show approval progress.
- Surface credit-check results clearly (available credit, overdue warning, hold reason).

Wire everything through React Query with optimistic-safe mutations and toast feedback. Deliver the pages, building green.
```

## Notes

- Reuse the PO line-grid component and item picker.
- Disable actions the current role/limit can't perform, based on RBAC context.
