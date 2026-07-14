# Prompt 4: SALES ENQUIRY & SALES QUOTATION — BACKEND + FRONTEND

## Context — what has been built so far

Masters are done: Customer (Prompt 2) and Price Lists with a PriceResolutionService (Prompt 3). Doc prefixes SEL and SQL are registered.
Build the first two pipeline documents: Sales Enquiry and Sales Quotation.

## TASK — copy everything below to Claude

```
Build SALES ENQUIRY and SALES QUOTATION end to end. Model these on the Procurement Enquiry/Quotation implementation but for the sell side.

SALES ENQUIRY:
- Service + routes (`/api/v1/sales/enquiries`): create/update/list/get, status transitions OPEN → QUOTED → WON/LOST → CLOSED, lost-reason capture.
- Header: customer (or free-text prospect name), enquiryDate, requiredByDate, salespersonId, source, notes. Lines: item/description, uom, qty, targetPrice.
- Action: convertToQuotation — creates a SalesQuotation carrying header + lines, sets enquiry status to QUOTED.

SALES QUOTATION:
- Service + routes (`/api/v1/sales/quotations`): CRUD, list, status DRAFT → SENT → ACCEPTED/REJECTED/EXPIRED.
- On line entry, call PriceResolutionService to prefill unitPrice/minPrice; allow override per PRICE_OVERRIDE_ALLOWED (warn below minPrice).
- Compute line netAmount and header totals (sub-total, discount, tax via tax codes, grand total).
- Revisioning: 'revise' creates Rev n+1 and supersedes the prior revision (retain history).
- Action: convertToOrder — creates a SalesOrder from an ACCEPTED quotation.
- PDF generation endpoint using a configurable template, and an email-dispatch stub (reuse existing mail/notification service).

FRONTEND: Enquiries and Quotations pages under Sales nav — list (ag-grid) + form (header + line grid + totals footer + action bar with Convert/Print/Send). Show price source and override warnings inline.

Deliver backend services+routes+tests and frontend pages, building green. Audit all state changes.
```

## Notes

- Reuse the totals/tax calculation helper here — you will need the identical logic in Order and Invoice; factor it into a shared SalesPricingService.
- The email step can be a stub that queues a notification if SMTP is not configured.
