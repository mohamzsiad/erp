# Prompt 10: SALES CONTRACT & BILL OF QUANTITIES (BOQ)

## Context — what has been built so far

Product-sales flow is complete (Phases 1–3). For construction projects, revenue is billed progressively against a BOQ rather than by delivery.
Build the Sales Contract and its BOQ. Prefix SCL is registered.

## TASK — copy everything below to Claude

```
Build the SALES CONTRACT with a BILL OF QUANTITIES end to end.

BACKEND (SalesContractService):
- Contract header: customer, projectRef/name, contractValue, start/end dates, payment terms, optional cost centre/project link, status.
- BOQ: BoqLine list (section, subSection, itemDescription, uom, contractQty, rate, contractAmount = qty × rate); grouped by section with section subtotals; validate total ≈ contractValue (warn on mismatch).
- Bulk BOQ import (CSV/paste) and inline editing.
- Variation orders: additive/omission variations that adjust BOQ line quantities or add lines, each with its own approval + audit; maintain original vs revised contract quantity.
- Routes `/api/v1/sales/contracts` (CRUD + /boq + /variations). RBAC, Swagger, audit.

FRONTEND: Contracts page — list + contract form with a BOQ ag-grid (sections, quantities, rates, amounts, subtotals), variation management, and a contract summary (value, variations, revised value).

Deliver building green with tests on BOQ totalling and variation adjustments.
```

## Notes

- Keep BoqLine cumulative fields out of the contract — progress is tracked on ProgressBillLine (Prompt 11).
- Retention/advance are out of scope now; leave the model open for them.
