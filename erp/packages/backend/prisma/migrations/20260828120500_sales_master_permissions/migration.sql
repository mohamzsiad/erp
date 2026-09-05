-- Grant the new Sales master resources (SALESMAN, PAYMENT_TERM) to every role that
-- already administers the customer master, mirroring its actions. Idempotent.
INSERT INTO "permissions" ("id", "roleId", "module", "resource", "action", "createdAt")
SELECT
  md5(p."roleId" || ':SALES:' || r.resource || ':' || p."action"::text)::text,
  p."roleId",
  'SALES'::"Module",
  r.resource,
  p."action",
  NOW()
FROM "permissions" p
CROSS JOIN (VALUES ('SALESMAN'), ('PAYMENT_TERM')) AS r(resource)
WHERE p."module" = 'SALES'
  AND p."resource" = 'CUSTOMERS'
  AND p."action" IN ('VIEW', 'CREATE', 'EDIT', 'DELETE')
ON CONFLICT ("roleId", "module", "resource", "action") DO NOTHING;
