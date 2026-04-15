# CloudERP — Modular Cloud-Native ERP Platform

A full-stack ERP system with Procurement, Inventory, and Finance modules.

**Stack:** React 18 · TypeScript 5 · Node.js 20 · Fastify 4 · Prisma 5 · PostgreSQL 16 · Redis 7 · Azure

---

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm 9+

---

## Quick Start

### 1. Clone and install dependencies

```bash
git clone <repo-url> clouderp
cd clouderp/erp
npm install
```

### 2. Set up environment variables

```bash
cp .env.example packages/backend/.env
# Edit packages/backend/.env with your values
```

### 3. Start infrastructure (PostgreSQL + Redis)

```bash
docker-compose up -d
# Wait for healthy: docker-compose ps
```

### 4. Run database migrations and seed

```bash
npm run db:migrate
npm run db:seed
```

### 5. Start development servers

```bash
npm run dev
```

- **Backend API:** http://localhost:3000
- **Frontend:** http://localhost:5173
- **Swagger Docs:** http://localhost:3000/api/v1/docs
- **Prisma Studio:** `npm run db:studio`

---

## Default Login

| Email             | Password   | Role           |
|-------------------|------------|----------------|
| admin@demo.com    | Admin@123  | System Admin   |

---

## Project Structure

```
erp/
├── packages/
│   ├── shared/          # Shared TypeScript types, DTOs, constants
│   ├── backend/         # Fastify API server
│   │   ├── src/
│   │   │   ├── plugins/     # Fastify plugins (prisma, redis, auth, cors, swagger)
│   │   │   ├── routes/      # Route handlers (auth, admin, procurement, inventory, finance)
│   │   │   ├── services/    # Business logic layer
│   │   │   ├── middleware/  # Auth + RBAC middleware
│   │   │   └── utils/       # Helpers (JWT, password, doc numbering)
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   └── frontend/        # React + Vite app
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Key Commands

| Command                  | Description                        |
|--------------------------|------------------------------------|
| `npm run dev`            | Start backend + frontend together  |
| `npm run dev:backend`    | Backend only (port 3000)           |
| `npm run dev:frontend`   | Frontend only (port 5173)          |
| `npm run db:migrate`     | Apply Prisma migrations            |
| `npm run db:seed`        | Seed demo data                     |
| `npm run db:studio`      | Open Prisma Studio                 |
| `npm run test`           | Run backend tests                  |
| `npm run build`          | Production build (all packages)    |

---

## API Documentation

Swagger UI is available at **http://localhost:3000/api/v1/docs** when running in development mode.

---

## Deployment

### Overview

CloudERP uses a **staging slot → production swap** deployment model on Azure:

```
GitHub tag (v*)
    → CI (typecheck + test + build)
    → Build & push Docker image to ACR
    → prisma migrate deploy (staging DB)
    → Deploy to App Service staging slot
    → Health check + smoke tests
    → Manual approval (GitHub Environment)
    → Slot swap (zero-downtime)
    → GitHub Release created
```

### Prerequisites

1. **Azure resources provisioned** via Bicep:

```bash
az login
az account set --subscription <SUBSCRIPTION_ID>

# Deploy infrastructure (first time)
az deployment group create \
  --resource-group rg-clouderp-prod \
  --template-file infra/main.bicep \
  --parameters infra/parameters/prod.json \
  --parameters adminObjectId=$(az ad signed-in-user show --query id -o tsv)
```

2. **GitHub Actions secrets** configured in repository settings:

| Secret | Description |
|---|---|
| `AZURE_CLIENT_ID` | Federated identity client ID (OIDC, no password) |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `ACR_LOGIN_SERVER` | e.g. `clouderp.azurecr.io` |
| `STAGING_DB_URL` | PostgreSQL connection string for staging migrations |
| `PROD_DB_URL` | PostgreSQL connection string for production migrations |
| `SWA_DEPLOYMENT_TOKEN` | Static Web App deployment token |
| `TEAMS_WEBHOOK_URL` | Teams channel webhook for deploy notifications |

3. **GitHub Environments** created:
   - `production` — requires at least 1 reviewer approval before deploy
   - `production-swap` — requires approval before slot swap (last gate)

### Deploy to Staging

Staging deploys automatically on every push to `main`:

```bash
git push origin main
# → .github/workflows/deploy-staging.yml triggers automatically
```

Monitor progress in the **Actions** tab. After the workflow completes, staging is accessible at the App Service staging slot URL.

### Deploy to Production

Production deploys are triggered by pushing a semver tag:

```bash
git tag v1.2.0
git push origin v1.2.0
# → .github/workflows/deploy-prod.yml triggers
# → Waits for 'production' environment approval in GitHub UI
# → Deploys, runs smoke tests
# → Waits for 'production-swap' environment approval
# → Swaps staging slot → production (zero-downtime)
# → Creates GitHub Release with changelog
```

### Run Locally with Docker

```bash
# Build backend image
docker build -f packages/backend/Dockerfile -t clouderp-backend:local packages/backend

# Run with local postgres + redis
docker-compose up -d
docker run --rm \
  --network erp_default \
  -e DATABASE_URL=postgresql://erp:erp@postgres:5432/erp \
  -e REDIS_URL=redis://redis:6379 \
  -e JWT_SECRET=local-dev-secret-min-32-chars-here \
  -e JWT_REFRESH_SECRET=local-dev-refresh-secret-min-32 \
  -p 3000:3000 \
  clouderp-backend:local
```

### Database Maintenance

The maintenance script runs daily at 02:00 UTC as an Azure Function timer trigger.
To run manually against any database:

```bash
export DATABASE_URL="postgresql://..."
export STORAGE_ACCOUNT_NAME="clouderpstg"
export STORAGE_CONTAINER="erp-audit-archive"
export WEBHOOK_URL="https://outlook.office.com/webhook/..."   # optional

bash infra/scripts/maintenance.sh
```

Tasks performed: VACUUM ANALYZE on key tables, index bloat detection, audit log archival to Blob Storage, DB size summary, webhook notification.

### Production Readiness

Before switching to full production traffic, complete every item in [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md).

Key gates:
- Front Door WAF switched from Detection → Prevention mode
- Load test: 500 concurrent users, p95 < 800ms
- App Insights alerts configured (error rate, response time, exceptions)
- Slot swap rollback tested

### Environment Variables Reference

All secrets are stored in Azure Key Vault and injected via managed identity references.
Non-secret configuration is set directly in App Service application settings.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token secret |
| `NODE_ENV` | Yes | `development` | `production` in App Service |
| `PORT` | No | `3000` | HTTP listen port |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed origins |
| `SMTP_HOST` | No | — | SMTP relay hostname |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASSWORD` | No | — | SMTP password (from Key Vault) |
| `SMTP_FROM` | No | — | Sender address |
| `RATE_LIMIT_PUBLIC` | No | `100` | Max requests/min (unauthenticated) |
| `RATE_LIMIT_AUTH` | No | `1000` | Max requests/min (authenticated) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No | — | App Insights telemetry |
| `STORAGE_ACCOUNT_NAME` | No | — | Azure Blob Storage account name |
| `STORAGE_CONTAINER` | No | `erp-audit-archive` | Blob container for audit archives |
| `WEBHOOK_URL` | No | — | Teams/Slack webhook for maintenance alerts |

---

## Architecture

- **Authentication:** JWT (15min access token) + Refresh tokens (7 days, stored in DB)
- **Authorization:** Role-Based Access Control (RBAC) with module-level and action-level granularity
- **Module Config:** Each module (Procurement, Inventory, Finance) can be toggled per company
- **Audit Trail:** All create/update/delete operations are logged to `audit_logs`
- **Document Numbers:** Atomic sequence generation with advisory locks (no duplicates under concurrent load)
