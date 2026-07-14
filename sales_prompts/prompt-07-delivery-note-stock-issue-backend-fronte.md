# Prompt 7: DELIVERY NOTE — STOCK ISSUE (BACKEND + FRONTEND)

## Context — what has been built so far

Sales Orders can be confirmed, approved, and reserve stock (Prompts 5–6). The Inventory StockMovement engine already handles stock in/out and valuation (used by GRN and Stock Issue).
Build the Delivery Note — the sales counterpart of the GRN — which dispatches goods and reduces stock.

## TASK — copy everything below to Claude

```
Build the DELIVERY NOTE end to end, reusing the Inventory StockMovement engine (see GRN/Stock Issue for the reference pattern).

BACKEND (DeliveryNoteService):
- Create from one or more approved Sales Order lines; support partial and consolidated deliveries; validate deliveredQty ≤ (orderedQty − alreadyDelivered).
- post(deliveryId) inside a DB transaction: post an OUTBOUND StockMovement (type SALES_ISSUE) per line, release the corresponding SO reservation, reduce on-hand, and capture unitCost/valuation for later COGS. Enforce ALLOW_NEGATIVE_STOCK.
- Update SalesOrderLine.deliveredQty and recompute order status (IN_PROGRESS/DELIVERED).
- Header: customer, deliveryDate, ship-to, warehouse, vehicle/driver; bin/lot selection if enabled. Status DRAFT → DISPATCHED → DELIVERED (with acknowledgement/POD).
- Set a ready-to-invoice flag on delivered lines.
- Routes `/api/v1/sales/deliveries` incl. /post and /acknowledge; RBAC, Swagger, audit. Printable delivery note / packing slip PDF.

FRONTEND: Deliveries page — list + form that pulls open SO lines to deliver, quantity entry, warehouse/bin, dispatch + acknowledge actions, print.

TESTS: stock is reduced exactly once, reservation released, partial deliveries accumulate correctly, negative-stock guard respected. Deliver building green.
```

## Notes

- COGS timing is an open item — capture cost at delivery now; the invoice will post the COGS journal unless Finance decides to post it here. Keep the cost on the line so either choice works.
- Do not double-count: releasing reservation and reducing on-hand must net correctly.
