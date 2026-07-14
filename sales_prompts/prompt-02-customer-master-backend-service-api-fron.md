# Prompt 2: CUSTOMER MASTER — BACKEND SERVICE, API & FRONTEND

## Context — what has been built so far

Prompt 1 created the Sales data model (extended Customer, contacts, addresses, categories, price lists, all sales documents), shared types, config, and doc-number prefixes. The migration is applied and seed data is loaded.
Now build the first master: the Customer master, end to end.

## TASK — copy everything below to Claude

```
Build the CUSTOMER MASTER for the Sales module, backend and frontend, following existing patterns (see the Supplier master in Procurement as the reference implementation).

BACKEND (`packages/backend`):
- CustomerService with CRUD, list (server-side pagination + search on code/name/trn + filters by category, active, creditHold), and nested management of contacts and addresses.
- Enforce a per-company unique customer code; auto-generate via DocSequence if not supplied.
- Duplicate detection on trn and name (warn).
- A read-only financial summary endpoint returning outstanding balance, overdue amount, and available credit computed from ArInvoice (available = creditLimit − (openReceivable + openOrdersNotInvoiced)).
- Optional onboarding: new customers start in Draft; approval required when creditLimit exceeds a configurable threshold (reuse WorkflowConfig).
- Fastify routes under `/api/v1/sales/customers` with JWT + RBAC preHandlers, Swagger schemas, and audit logging on create/update/delete.

RBAC: add sales roles/permissions — Sales Manager, Sales Officer, Sales Coordinator, Credit Controller, Billing Officer — with module 'sales' and appropriate action grants. Credit-limit override restricted to Credit Controller and above.

FRONTEND (`packages/frontend`):
- Add a 'Sales' section to the left navigation with a 'Customers' page.
- Customer list: ag-grid with paging/filtering, credit-status badge, New/Edit actions.
- Customer form: tabbed (General, Contacts, Addresses, Commercial/Credit, Financial summary), React Query mutations, validation, matching the existing form design.

Deliver backend service+routes+tests and the frontend pages, all building green.
```

## Notes

- Reuse the ag-grid list wrapper and form components already used by the Supplier and Item masters — do not build new primitives.
- The financial-summary endpoint is read-only; do not mutate AR here.
