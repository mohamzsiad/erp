# CloudERP -- Demo Data Seed Runner
# Prerequisites: Docker Desktop running, base seed already applied (npm run seed)
# Usage:  .\prisma\run-demo-seed.ps1

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$sqlFile    = Join-Path $scriptDir "seed-demo.sql"
$container  = "clouderp_postgres"
$dbUser     = "erpadmin"
$dbName     = "clouderp"

Write-Host ""
Write-Host "CloudERP Demo Data Seeder" -ForegroundColor Cyan
Write-Host "-------------------------------------------------" -ForegroundColor DarkGray

# Check Docker is available
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker not found. Please ensure Docker Desktop is running."
    exit 1
}

# Check container is running
$status = docker inspect --format='{{.State.Status}}' $container 2>$null
if ($status -ne "running") {
    Write-Error "Container '$container' is not running. Start it with: docker-compose up -d"
    exit 1
}

Write-Host "OK Container $container is running" -ForegroundColor Green

# Copy SQL file into container and run it
Write-Host "Copying seed-demo.sql to container..." -ForegroundColor Yellow
docker cp $sqlFile "${container}:/tmp/seed-demo.sql"
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to copy SQL file."; exit 1 }

Write-Host "Running demo seed..." -ForegroundColor Yellow
docker exec -e PGPASSWORD=erppassword $container `
    psql -U $dbUser -d $dbName -f /tmp/seed-demo.sql

if ($LASTEXITCODE -ne 0) {
    Write-Error "Seed failed. Check the output above for errors."
    exit 1
}

Write-Host ""
Write-Host "Demo data inserted successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Login credentials:" -ForegroundColor Cyan
Write-Host "  Admin:           admin@demo.com    / Admin@123"
Write-Host "  Procurement Mgr: proc.mgr@demo.com / Demo@123"
Write-Host "  Inventory Mgr:   inv.mgr@demo.com  / Demo@123"
Write-Host ""
Write-Host "Procurement data seeded:" -ForegroundColor Cyan
Write-Host "  - 8 MRLs  (DRAFT, SUBMITTED, APPROVED, CONVERTED)"
Write-Host "  - 4 PRLs  (APPROVED, PO_CREATED)"
Write-Host "  - 11 POs  (DRAFT, SUBMITTED, APPROVED, PARTIAL, RECEIVED)"
Write-Host "  - 7 GRNs  (POSTED - with planned vs actual delivery for lead time report)"
Write-Host "  - 17 items across Engineering, Electrical, Chemicals, Safety categories"
Write-Host "  - 6 suppliers"
Write-Host ""
