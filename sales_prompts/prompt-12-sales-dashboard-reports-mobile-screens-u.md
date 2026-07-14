# Prompt 12: SALES DASHBOARD, REPORTS, MOBILE SCREENS & UAT

## Context — what has been built so far

The full Sales backend and web frontend are built (Prompts 1–11): masters, order cycle, fulfilment, billing, and project billing, all integrated with Inventory and Finance. A Flutter mobile app already exists at `Mobile/erp_mobile` with feature-based architecture (Riverpod + go_router + dio).
This final prompt adds management reporting, the dashboard, mobile sales screens, and a verification pass.

## TASK — copy everything below to Claude

```
Build the SALES DASHBOARD, REPORTS, and MOBILE screens, then verify the module.

1. REPORT ENGINE (backend, under `/api/v1/sales/reports`), reusing the existing report/query pattern:
- Sales Pipeline (enquiries/quotations by stage, value, salesperson).
- Order Book (open/partially delivered orders, backlog value).
- Sales Register (invoiced sales by period/customer/item/salesperson).
- Delivery Report; Quotation Conversion (win rate + lost reasons).
- VAT/Output-Tax report by period.
- Customer Ageing and Customer Statement (from AR).
- BOQ Progress (contract value, certified-to-date, this bill, balance, % complete).
- Price List / Margin (selling price vs cost, gross margin).
Each report: filters, pagination, and export (Excel/CSV) via the existing export util.

2. SALES DASHBOARD (web): KPI cards (order book value, monthly sales, pipeline value, deliveries due, overdue receivables), top-customers and sales-trend charts, using the existing dashboard/chart components.

3. MOBILE (Flutter, `Mobile/erp_mobile`): add a Sales feature group following the existing feature/ data/providers/ui structure — customer lookup, quotations, sales orders (view + approve), deliveries, and invoices (read + status). Reuse the app's api_client, auth, theme, and widgets; wire routes into app_router. Generate freezed/json/riverpod code with build_runner.

4. VERIFICATION: run `npm run build` and `npm run test` for backend and frontend and `flutter analyze` for mobile; fix issues. Add a short smoke checklist covering the end-to-end flows: product sale (enquiry→quote→order→delivery→invoice→receipt) and project sale (contract→BOQ→progress bill→AR).

Deliver reports, dashboard, mobile screens, and a green build/test across all three packages.
```

## Notes

- Split this prompt if it runs long: (a) reports, (b) dashboard, (c) mobile, (d) verification.
- For mobile, remember generated files (*.g.dart/*.freezed.dart) are not committed by default — run build_runner and document it.
- Use a subagent or a dedicated test pass for the final end-to-end verification.
