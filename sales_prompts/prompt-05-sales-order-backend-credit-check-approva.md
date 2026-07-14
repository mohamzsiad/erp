# Prompt 5: SALES ORDER — BACKEND (CREDIT CHECK, APPROVAL, STOCK RESERVATION)

## Context — what has been built so far

Enquiry and Quotation are built (Prompt 4), including a shared SalesPricingService for line/total/tax calculation. Config flags CREDIT_CHECK_MODE, RESERVE_STOCK_ON_ORDER, and SO_APPROVAL_REQUIRED exist.
Build the Sales Order backend — the core of the order-to-cash flow. Frontend comes in Prompt 6.

## TASK — copy everything below to Claude

```
Build the SALES ORDER BACKEND. This is the most important service in the module — get the transactional integrity right.

SalesOrderService with:
- create/update (Draft), from-scratch or from a quotation; line pricing via SalesPricingService; per-line orderedQty/deliveredQty/invoicedQty tracking.
- confirm(orderId): runs, inside a DB transaction —
1. CREDIT CHECK: compute available credit = creditLimit − (open receivable + open orders not yet invoiced). Apply CREDIT_CHECK_MODE: BLOCK (reject with clear error), WARN (proceed, set status CREDIT_HOLD, notify Credit Controller), OFF (skip). Also flag if customer has overdue invoices.
2. APPROVAL: if SO_APPROVAL_REQUIRED, route through WorkflowConfig using order value + the approver's monetary authorization limit; set PENDING_APPROVAL and create approval tasks + notifications. Otherwise set APPROVED.
3. STOCK RESERVATION: if RESERVE_STOCK_ON_ORDER and orderType involves stock, reserve confirmed quantities (reduce Available-to-Promise) via the StockMovement/StockBalance reservation mechanism — do NOT reduce on-hand yet.
- approve/reject(orderId): move CREDIT_HOLD/PENDING_APPROVAL → APPROVED or back to DRAFT with reason; Credit Controller can release a credit hold.
- amend, shortClose, cancel (releases outstanding reservations), and status recompute (IN_PROGRESS/DELIVERED/CLOSED) based on delivered/invoiced quantities.
- An availability endpoint returning ATP per line (on-hand − reserved) for the UI.

Routes under `/api/v1/sales/orders` incl. /confirm, /approve, /reject, /release-hold, /cancel, /short-close, /availability. RBAC-protected, Swagger, audited.

TESTS: unit-test the credit-check math (all three modes + overdue), the approval routing threshold, and reservation/release. Ensure confirm is atomic — a failure rolls back reservation and status.

Deliver the service, routes, and tests. No frontend in this prompt.
```

## Notes

- Follow the PoService pattern for transaction handling and status machines.
- Reservations must be released on cancel/short-close or stock will leak — cover this in tests.
- Do not deduct on-hand here; that happens at Delivery (Prompt 7).
