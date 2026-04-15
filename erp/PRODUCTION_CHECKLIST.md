# CloudERP — Production Readiness Checklist

> Complete every item below before switching Azure Front Door WAF from Detection → Prevention
> and before cutting traffic to production.  
> Sign off each item with your initials and date: `[x] Description — *MJS 2026-04-15*`

---

## 1. Infrastructure & Secrets

- [ ] All required environment variables are stored as Key Vault secrets
  - `DATABASE-URL` — PostgreSQL connection string (with SSL mode)
  - `REDIS-URL` — Azure Cache for Redis connection string
  - `JWT-SECRET` — minimum 64 random characters
  - `JWT-REFRESH-SECRET` — minimum 64 random characters, different from JWT-SECRET
  - `SMTP-PASSWORD` — SMTP relay credential
  - `AZURE-STORAGE-CONNECTION-STRING` — Blob Storage for audit archives
- [ ] App Service managed identity has **Key Vault Secrets User** role confirmed
- [ ] App Service staging slot managed identity has the same Key Vault role
- [ ] `APPLICATIONINSIGHTS_CONNECTION_STRING` set in both production and staging app settings
- [ ] `CORS_ORIGINS` contains only the production and staging frontend domains (no `*`)
- [ ] `NODE_ENV=production` confirmed in App Service application settings
- [ ] No secrets present in `infra/parameters/*.json`, `.env` files, or source control

---

## 2. Database

- [ ] PostgreSQL SSL connection enforced (`require_secure_transport = on` server parameter)
- [ ] PostgreSQL Flexible Server firewall rules: only App Service subnet allowed, no public access
- [ ] Entra (Azure AD) authentication enabled on Flexible Server
- [ ] PgBouncer connection pooling enabled and connection string uses port 6432
- [ ] Zone-redundant High Availability enabled for production server
- [ ] Geo-redundant backup enabled with **minimum 7-day retention** confirmed in Azure portal
- [ ] Point-in-time restore tested at least once in staging
- [ ] All Prisma migrations applied (`prisma migrate deploy` exit code 0 in deploy log)
- [ ] Database seeded with required reference data (GL accounts, cost centres, currencies)
- [ ] Admin password changed from seed defaults (check `prisma/seed.ts` default credentials)
- [ ] No superuser/postgres password exposed in any config or log

---

## 3. Application Configuration

- [ ] Module configuration reviewed for go-live (disable unused modules via `/admin/modules`)
- [ ] GL Account mappings configured for auto-posting rules (AP invoices, GRN accruals)
- [ ] Document sequences initialized for all active document types:
  - Purchase Requisitions (`PR-`)
  - Material Requisitions (`MRL-`)
  - Purchase Orders (`PO-`)
  - AP Invoices (`INV-`)
  - Journal Entries (`JE-`)
- [ ] Approval workflow templates configured and tested end-to-end for each document type
- [ ] Email/SMTP relay tested — approval notifications delivered successfully
- [ ] At least one Company record exists with correct base currency and fiscal year settings
- [ ] At least one Location/Warehouse configured
- [ ] Default roles and permissions reviewed; no overly permissive role grants

---

## 4. Security

- [ ] Azure Front Door WAF policy switched from **Detection** to **Prevention** mode
- [ ] Front Door WAF custom rate-limit rule (300 req/min) confirmed active
- [ ] `Microsoft_DefaultRuleSet 2.1` and `Microsoft_BotManagerRuleSet 1.0` rule sets active
- [ ] HSTS header present in production responses (`Strict-Transport-Security: max-age=31536000`)
- [ ] Custom domain applied to Front Door endpoint and Static Web App
- [ ] TLS certificate provisioned (Azure-managed or custom) — no browser certificate warnings
- [ ] App Service `minTlsVersion: 1.2` and `ftpsState: Disabled` confirmed
- [ ] HTTP → HTTPS redirect active at Front Door level
- [ ] `/api/v1/admin/*` routes tested — non-admin JWT returns 403
- [ ] Rate limiting smoke test: >100 requests/minute from single IP returns 429

---

## 5. Observability & Alerting

- [ ] Azure Application Insights resource connected; live metrics visible
- [ ] **Alert rule**: Failed requests rate > 5% over 5 minutes → PagerDuty / Teams webhook
- [ ] **Alert rule**: Average response time > 2 seconds over 5 minutes → warning notification
- [ ] **Alert rule**: Server exceptions > 10 per minute → critical notification
- [ ] **Alert rule**: PostgreSQL CPU > 80% for 5 minutes → scale-up investigation
- [ ] **Alert rule**: Redis memory usage > 85% → eviction risk notification
- [ ] App Insights availability test configured for `/api/v1/health` (every 5 minutes, 3 locations)
- [ ] Log retention set to minimum 90 days in Log Analytics workspace
- [ ] Maintenance script (`infra/scripts/maintenance.sh`) scheduled as Azure Function timer trigger at 02:00 UTC
- [ ] Maintenance script webhook URL (`WEBHOOK_URL`) set to Teams/Slack channel
- [ ] At least one maintenance script dry-run verified against staging database

---

## 6. Performance & Load

- [ ] Load test completed simulating **500 concurrent users** for 10 minutes
  - Recommended tool: Azure Load Testing (JMeter) or k6
  - Target: p95 response time < 800ms, error rate < 0.5%
- [ ] Auto-scale policy verified: instances scale from 1 → 5 when CPU exceeds 70%
- [ ] Redis cache hit rate > 80% under load test conditions
- [ ] PgBouncer pool size tuned for expected concurrency (default: `max_client_conn = 100`)
- [ ] Frontend bundle size reviewed — no chunk > 1 MB uncompressed
- [ ] Static Web App CDN cache headers confirmed for JS/CSS assets

---

## 7. CI/CD & Deployment

- [ ] `production` GitHub Environment configured with required reviewers (minimum 1 approver)
- [ ] `production-swap` GitHub Environment configured separately for slot swap approval
- [ ] GitHub Actions secrets set: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ACR_LOGIN_SERVER`, `STAGING_DB_URL`, `PROD_DB_URL`, `SWA_DEPLOYMENT_TOKEN`, `TEAMS_WEBHOOK_URL`
- [ ] Full staging deployment completed successfully (workflow run green)
- [ ] Staging smoke tests passed: health endpoint returns `{"status":"ok"}`, auth returns 401
- [ ] Production deployment promoted via slot swap (no downtime confirmed)
- [ ] Rollback procedure tested: re-swap staging ↔ production within 2 minutes

---

## 8. Backup & Disaster Recovery

- [ ] Recovery Point Objective (RPO) agreed with stakeholders: **1 hour** (continuous WAL archiving)
- [ ] Recovery Time Objective (RTO) agreed with stakeholders: **4 hours**
- [ ] Backup restore drill completed for PostgreSQL (document steps and actual restore time)
- [ ] Audit log archive job tested: CSV uploaded to `erp-audit-archive` Blob container
- [ ] Blob Storage geo-redundant replication (GRS or RA-GRS) enabled
- [ ] Key Vault soft-delete and purge-protection enabled (prevents accidental secret deletion)

---

## 9. Go-Live Sign-off

| Area | Owner | Sign-off |
|---|---|---|
| Infrastructure & Secrets | DevOps | |
| Database | DBA / Backend | |
| Application Config | Functional Lead | |
| Security | Security / DevOps | |
| Observability | DevOps | |
| Performance | Backend / QA | |
| CI/CD | DevOps | |
| Backup & DR | DBA / Ops | |

**Go-live approved by:** _________________________ **Date:** _____________
