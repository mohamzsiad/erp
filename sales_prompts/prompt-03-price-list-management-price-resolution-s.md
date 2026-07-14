# Prompt 3: PRICE LIST MANAGEMENT & PRICE-RESOLUTION SERVICE

## Context — what has been built so far

The Customer master is complete (Prompt 2). Sales documents will need unit prices resolved automatically from price lists, with manual override.
Build price-list management and a reusable price-resolution service that later prompts (quotation, order, invoice) will call.

## TASK — copy everything below to Claude

```
Build PRICE LIST MANAGEMENT for the Sales module.

BACKEND:
- PriceListService: CRUD for price lists and their items; import items in bulk; activate/deactivate; enforce one default list per company.
- A PriceResolutionService with a method resolvePrice({ companyId, customerId, itemId, uomId, date }) returning { unitPrice, minPrice, source } using this order: customer-specific price list → customer-category price list → company default price list → null (manual entry required).
- Respect validity dates; return the minPrice so callers can enforce the override floor.
- Routes under `/api/v1/sales/price-lists` (CRUD) and `/api/v1/sales/price-lookup` (resolve endpoint), RBAC-protected, Swagger-documented, audited.

FRONTEND:
- 'Price Lists' page under the Sales nav: list of price lists, and an editor with an ag-grid of items (item, uom, unit price, min price, validity), inline add/edit, and assignment (customer / category / default).

Also expose the config flag PRICE_OVERRIDE_ALLOWED and honour it later: when true, document lines may override the resolved price but overriding below minPrice raises a warning (and, per config, an approval requirement) and is always audited.

Deliver backend service+routes+unit tests for resolvePrice (cover all four resolution branches) and the frontend page.
```

## Notes

- Write unit tests for PriceResolutionService first — it is the piece most reused downstream.
- Keep resolvePrice pure and side-effect free so it can be called inside document transactions.
