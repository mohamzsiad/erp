# CloudERP -- Full 50-Record Seeder Runner
# Prerequisites:
#   1. Docker Desktop running
#   2. Run from: packages\backend
#
# Usage:
#   cd packages\backend
#   .\prisma\run-full-seed.ps1

Set-Location $PSScriptRoot\..

Write-Host ""
Write-Host "CloudERP Full 50-Record Seeder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor DarkGray

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker not found. Please ensure Docker Desktop is running."
    exit 1
}

$status = docker inspect --format='{{.State.Status}}' clouderp_postgres 2>$null
if ($status -ne "running") {
    Write-Error "Container 'clouderp_postgres' is not running. Start with: docker-compose up -d"
    exit 1
}
Write-Host "OK  Docker container is running" -ForegroundColor Green

# Step 1: Base seed
Write-Host ""
Write-Host "Step 1/3 -- Running base seed..." -ForegroundColor Yellow
npx ts-node --project tsconfig.json prisma/seed.ts
if ($LASTEXITCODE -ne 0) { Write-Error "Base seed failed"; exit 1 }
Write-Host "  Base seed complete" -ForegroundColor Green

# Step 2: Demo procurement seed
Write-Host ""
Write-Host "Step 2/3 -- Running demo procurement seed..." -ForegroundColor Yellow
npx ts-node --project tsconfig.json prisma/seed-demo.ts
if ($LASTEXITCODE -ne 0) { Write-Error "Demo seed failed"; exit 1 }
Write-Host "  Demo seed complete" -ForegroundColor Green

# Step 3: Full 50-record seed
Write-Host ""
Write-Host "Step 3/3 -- Running full 50-record seed..." -ForegroundColor Yellow
npx ts-node --project tsconfig.json prisma/seed-full.ts
if ($LASTEXITCODE -ne 0) { Write-Error "Full seed failed"; exit 1 }

Write-Host ""
Write-Host "========================================" -ForegroundColor DarkGray
Write-Host "All seeds complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Login credentials:" -ForegroundColor Cyan
Write-Host "  Admin:           admin@demo.com     / Admin@123"
Write-Host "  Procurement Mgr: proc.mgr@demo.com  / Demo@123"
Write-Host "  Inventory Mgr:   inv.mgr@demo.com   / Demo@123"
Write-Host "  Finance Manager: fin.mgr@demo.com   / Demo@123"
Write-Host "  Store Keeper:    store1@demo.com     / Demo@123"
Write-Host "  Accountant:      acc1@demo.com       / Demo@123"
Write-Host ""
Write-Host "Tables populated:" -ForegroundColor Cyan
Write-Host "  Core        : users, roles, locations, currencies, exchange_rates"
Write-Host "  Procurement : suppliers, purchase_orders, grn_headers, po_lines, grn_lines"
Write-Host "  Inventory   : items, warehouses, bins, stock_balances, stock_movements"
Write-Host "                stock_issues, stock_transfers, stock_adjustments"
Write-Host "                adjustment_reasons, stock_issue_lines, stock_transfer_lines"
Write-Host "  Finance     : gl_accounts, cost_centers, cost_codes, journal_entries"
Write-Host "                journal_lines, ap_invoices, ap_payments, ar_invoices"
Write-Host "                ar_receipts, budgets, budget_periods"
Write-Host "  Other       : notifications, audit_logs, doc_sequences"
Write-Host ""
