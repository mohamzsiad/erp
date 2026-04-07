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

## Architecture

- **Authentication:** JWT (15min access token) + Refresh tokens (7 days, stored in DB)
- **Authorization:** Role-Based Access Control (RBAC) with module-level and action-level granularity
- **Module Config:** Each module (Procurement, Inventory, Finance) can be toggled per company
- **Audit Trail:** All create/update/delete operations are logged to `audit_logs`
- **Document Numbers:** Atomic sequence generation with advisory locks (no duplicates under concurrent load)
