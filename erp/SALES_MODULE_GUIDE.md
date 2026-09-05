# CloudERP Sales Module — Run & Verification Guide

Built across the 12-prompt staged plan. This document covers what shipped, how to run it, and a smoke checklist to verify the end-to-end flows.

## What's in the module

**Masters** — Customer master (addresses carrying their own contact + VAT/CR details, country/city from the reference masters, company-wise commercial terms, multi-currency, tax, price list, salesman), Salesman master, Payment Terms master (staged instalment schedules), Country/City reference data with per-country VAT rules, Customer categories, Price lists (Standard and Customer-Specific) with a tiered resolution service, Tax codes.

**Order-to-cash** — Sales Enquiry → Quotation (price resolution + override warnings, revisions) → Sales Order (header saved first to issue the document number and lock the customer; payment terms, currency and salesman spooled off the customer master; per-line warehouse + group stock, price-list rate, and explicit stock reservations with a reserve-until date) → Delivery Note (issues stock via StockMovement, releases reservation) → Sales Invoice (auto-posts AR invoice + balanced GL journal: Dr AR, Cr Revenue, Cr VAT Output, Dr COGS, Cr Inventory).

**Reversals** — Sales Returns (inbound stock restore) and Credit Notes (reversing journal + allocation against the original invoice).

**Project billing** — Sales Contracts with a BOQ (sections, subtotals, variations preserving original quantities) and Progress Bills / IPCs (cumulative certification with over-billing guard, posting Dr AR / Cr Contract Revenue / Cr VAT).

**Reporting** — Sales dashboard (KPI cards + trend & top-customer charts) and a report engine (pipeline, order book, sales register, VAT, customer ageing, BOQ progress) with CSV export.

**Mobile** — Flutter Sales feature group (customers, quotations, orders, invoices list screens) in `Mobile/erp_mobile`.

All of it reuses the existing platform plumbing: DocSequence numbering, WorkflowConfig, StockMovement/StockBalance, AccountMapping, and JournalService.

## Run it (web)

```bash
cd erp
docker-compose up -d                    # Postgres + Redis
cp .env.example packages/backend/.env   # first time only
npm install                             # deps + prisma client
npm run db:migrate                      # applies all sales schema (models + salesConfig, CustomerCategory.priceListId, BoqLine.originalQty)
npm run db:seed                         # SALES module + roles + sample customers/price list/tax codes
npm run dev                             # backend :3000, frontend :5173
```

Log in `admin@demo.com / Admin@123` → the **Sales** section shows Dashboard, Reports, Masters (Customers, Salesmen, Payment Terms, Price Lists), Transactions (Enquiries, Quotations, Orders, Deliveries, Invoices, Returns, Credit Notes), and Projects (Contracts, Progress Bills).

> If Sales doesn't appear on an already-seeded DB, the demo company's `modulesEnabled` won't be updated by a re-seed (company upsert has `update: {}`). Either `npx prisma migrate reset --schema packages/backend/prisma/schema.prisma`, or add `"SALES"` to the `companies.modulesEnabled` row in Prisma Studio and re-login.

## Run it (mobile)

```bash
cd Mobile/erp_mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # generates *.g.dart / *.freezed.dart
flutter analyze                                              # verify the new sales feature compiles
flutter run
```

Set the API base URL in `lib/core/api/api_constants.dart` (`10.0.2.2` for Android emulator, `127.0.0.1` for iOS simulator, LAN IP for a device). The new sales screens live in `lib/features/sales/` and are routed at `/sales/customers`, `/sales/quotations`, `/sales/orders`, `/sales/invoices`.

## Smoke checklist

**Masters**
1. Salesman Master → New Salesman (code auto-generates; set type, markup/variance limits, sales & delivery location).
2. Payment Terms → New Payment Term with a schedule; the instalment percentages must total 100%.
3. Price Lists → create a **Standard** list (attach to many customers/categories) and a **Customer Specific** list (one customer + currency; a customer may hold only one).
4. Customer Master → General (salesman, currency), Addresses (a Bill To and a Ship To, each with its own contact person / email / phone / fax and VAT, CR and tax-card numbers), Commercial & Credit, and Companies (per-company credit limit, payment terms, price list and salesman).

**Product sale (stock)**
1. Create a Customer with a credit limit; assign the default price list.
2. New Quotation → add a line (price auto-fills from the price list) → Send → Mark Accepted → Convert to Order.
3. New Order → fill the header (payment terms, currency and salesman spool from the customer) → **Save Header**: the document number is issued, the customer locks, and item details open up.
4. Add a line — the rate spools from the price list, and the two stock columns show free stock in the selected warehouse and across every warehouse in the company.
5. Enter a Reservation qty and Reserve Until date to block stock; if the order's warehouse is short, pick another warehouse in the reservation popover. Reservations release automatically once the reserve-until date passes.
6. Open the Order → Confirm (watch the credit-check banner + approval/reservation) → Approve if pending.
7. New Delivery → pick the approved order → deliver quantities → Dispatch (stock on-hand drops, reservation releases) → Mark Delivered.
8. New Invoice → Create from the dispatched delivery → Post (check the "posted to AR & GL" confirmation; the journal balances Dr AR / Cr Revenue / Cr VAT / Dr COGS / Cr Inventory).
9. New Return against the invoice → Approve → Receive (stock restored) → Credit Note from the return → Approve → Post (receivable reduced).

**Project sale (contract)**
1. New Contract → add BOQ lines (sections, qty × rate) → Activate; optionally apply a variation.
2. New Progress Bill → select the contract → enter cumulative % per line → check the live this-value + progress bar → Submit → Certify → Post to AR.
3. Reports → BOQ Progress shows certified-to-date and balance.

**Dashboard / reports** — the Sales dashboard KPIs and charts populate; each report renders and exports CSV.

## Verification status (this build)

- **Backend:** every sales service + route type-checks against a freshly generated Prisma client — **0 errors**.
- **Tests:** **143 unit tests across 14 suites** pass (pricing, price resolution incl. customer-specific and company-terms tiers, order credit/approval, line stock reservations, payment-term due dates, short-name / CODE—NAME / VAT-format master rules, delivery stock math, invoice/credit-note journals, contract BOQ/variations, progress-bill certification, report aggregation). `jwt.test.ts` / `password.test.ts` need runtime env vars and are excluded from that run.
- **Frontend:** all sales pages + API modules type-check against the shared types — **0 errors**.
- **Mobile:** feature written to match the app's architecture; run `flutter analyze` on your machine to confirm (Flutter isn't available in the build environment).

## Corrections applied (sales_corrections.xlsx)

- **Customer master** — VAT number removed from the main screen; Active/Inactive is a checkbox; contacts folded into the address rows (contact person, email, phone, fax for both Bill To and Ship To); VAT and Company Registration numbers moved onto the address; a Companies grid holds company-wise credit limit, credit exposure, payment terms, price list, salesman and black/grey-list flags; a Salesman master exists and customers map to it.
- **Price lists** — split into Standard (one list → many customers/categories) and Customer Specific (one list → exactly one customer, with its own currency and exchange rate). Only a standard list can be the company default.
- **New masters** — Salesman and Payment Terms, both under Sales → Masters. The `SALESMAN` and `PAYMENT_TERM` permissions are granted by migration to every role that already administers customers, so no re-seed is needed.
- **Sales order** — payment terms and currency spool from the customer (company-terms row first, then the customer header); a Sales Location field records where the order is raised; the header must be saved before item details open, which is when the running document number is issued; the customer is frozen from then on; each line shows warehouse stock and group stock, spools its rate from the price list, and carries a reservation quantity, reserve-until date and optional alternate reservation warehouse.

## Feedback round 2 (feedback 2.xlsx)

- **Short names (1, 2)** — Short / Trade Name mirrors the full name as you type, capped at 50 characters, and stops following once you edit it. Same behaviour on Customer, Salesman and Payment Term; the API applies the identical rule when the field arrives blank.
- **Salesman (3, 4)** — Sales & Delivery Location is enabled only for a Van Salesman (and cleared server-side for any other type). Related Salesman is gone.
- **Customer (5, 25)** — a Currencies Allowed multi-select limits which currencies a sales order may use, with the header currency as the default. Credit Limit has left Commercial & Credit: it is maintained per company on the Companies grid, and the credit check reads it from there.
- **Address (6, 7, 8, 9)** — field order is now Country → City → Postal Code → Street. City is a dropdown filtered by the chosen country, and the VAT Registration No is validated against that country's mandated length/prefix (Oman `OM` + 15, UAE/Saudi/Bahrain 15, Qatar 11, UK `GB` + 11 — editable in the Country master). A **Same as Bill To** button copies the bill-to address onto a ship-to row.
- **Blacklist / Hold (10)** — both are checkboxes on Commercial & Credit beside Payment Terms, with the Companies grid overriding per company.
- **Price list (11, 13, 14, 15, 16, 17)** — the code is mandatory and unique (auto-generated `STD001` / `CSP001` when blank, existing rows backfilled by the migration); the exchange rate is gone; picking an item shows its running weighted average cost before the price is keyed; a line cannot be saved without both Valid From and Valid To; and the assign-to-customer panel is removed since customers get their price list on the customer master.
- **Dropdowns (18)** — every master lookup renders as `CODE — NAME` through a single shared helper.
- **Document flow (19, 20)** — an enquiry can only be quoted while it is live, and only an ACCEPTED quotation converts to an order. Each document can also be raised directly: the New Quotation screen offers "create from an enquiry" and the New Order screen offers "create from an accepted quotation", both optional.
- **Sales order (21, 22, 23, 24, 26)** — Requested Date is now **Delivery Date**; salesman, currency and payment terms spool from the customer master; the unit price is read-only and always comes from the price list (an unpriced item stays at 0); reservation controls appear only for items flagged **Reservation Allowed** on the item master; and Cancel is limited to an untouched draft — anything confirmed or part-delivered is short-closed instead.

## Carry-over notes

- The pre-existing backend route-typing issue (documented in `BACKEND_BUILD_FIX_PLAN.md`) still gates a fully-green `npm run build`. `npm run dev` runs fine (tsx skips type-checks); **all new sales routes use the correct typing pattern and add zero errors**.
- Approval routing for Sales Orders uses a monetary threshold (from `WorkflowConfig(SALES,SOL)` or `salesConfig.SO_APPROVAL_THRESHOLD`); full multi-level `WorkflowService` routing can layer on later.
- The quotation/order/invoice line editors don't yet include a tax-code picker (no tax-code list endpoint exists) — lines default untaxed in the UI, though the backend fully applies VAT when a `taxCodeId` is present.
