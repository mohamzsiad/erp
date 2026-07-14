# Backend Build Fix Plan

**Status:** backend `npm run build` (`tsc`) currently fails. `npm run dev` still works (tsx skips type-checking). Diagnosed 2026-07-14.

---

## TL;DR

The backend has a **systemic route-typing problem** across ~37 route files (~300 call sites). It was never caught because development runs on **tsx**, which strips types without checking — so `tsc` / `npm run build` was effectively never run green. The fix is mechanical but broad: move the request generic from the handler parameter onto the route method.

One isolated fix has already been applied: removing `prisma/seed.ts` from `packages/backend/tsconfig.json` `include` (it was outside `rootDir: src`, causing TS6059). The seed still runs via `tsx prisma/seed.ts` — it does not need to be compiled.

---

## Root cause

Every route handler is written like this:

```ts
// packages/backend/src/routes/finance/accounts.ts (representative)
fastify.get('/', {
  schema: { /* ... */ },
  preHandler: [PERM.VIEW],
}, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
  return reply.send(await svc(req).list(req.user.companyId, req.query));
});
```

The request generic (`{ Querystring: any }`) is placed on the **handler parameter** instead of on the **route method**. Under the installed Fastify (`4.29.1`) with `strict: true`, this fails two ways:

1. **Handler not assignable (TS2345).** The handler typed `(req: FastifyRequest<{ Querystring: any }>) => ...` is not assignable to the method's expected `RouteHandlerMethod<... RouteGenericInterface ...>`, because `RouteGenericInterface` (where `Querystring` is optional/`unknown`) is not assignable to `{ Querystring: any }`. This is `strictFunctionTypes` contravariance.
2. **`unknown` member access (TS18046 / TS2345).** Where a handler does *not* annotate `req`, `req.query` / `req.body` / `req.params` resolve to `unknown`, and then get passed into typed service calls, producing "unknown is not assignable" errors.

Error volume: **341** type errors on `tsc --noEmit`, concentrated in finance/inventory/procurement route files (e.g. `finance/budgets.ts` 26, `inventory/StockSummaryService.ts` 24, `inventory/items.ts` 23).

> Note: `@fastify/websocket` (registered in `app.ts`, used by `routes/notifications/index.ts` `/ws`) adds a `websocket` route overload that produces extra "Property 'websocket' is missing" noise on top of the above, but it is **not** the cause — removing it leaves all 341 errors. Leave the websocket code as-is; once routes are typed correctly the overload resolves cleanly.

---

## The fix (per route)

Move the generic onto the method and drop the handler-parameter annotation:

```ts
// BEFORE
fastify.get('/', {
  schema: { /* ... */ },
  preHandler: [PERM.VIEW],
}, async (req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
  return reply.send(await svc(req).list(req.user.companyId, req.query));
});

// AFTER
fastify.get<{ Querystring: any }>('/', {
  schema: { /* ... */ },
  preHandler: [PERM.VIEW],
}, async (req, reply) => {
  return reply.send(await svc(req).list(req.user.companyId, req.query)); // req.query now typed
});
```

Rules:
- For each `fastify.<method>(path, opts, handler)` where the handler annotates `req: FastifyRequest<G>`, move `<G>` onto the method and delete the `: FastifyRequest<G>` (and usually `: FastifyReply`) annotations, letting them infer.
- For handlers with **no** generic that still read `req.query`/`req.body`/`req.params`, add the appropriate `<{ Querystring | Body | Params: ... }>` generic so those members type correctly. Prefer real DTO types from `@clouderp/shared` over `any` where they exist.
- Websocket route in `routes/notifications/index.ts` stays as `fastify.get('/ws', { websocket: true }, (socket, req) => ...)`.

---

## Recommended execution (next session, stable filesystem)

1. Work on a clean checkout where the filesystem is reliable (this session's mount intermittently corrupted written files — NUL-padding and truncation — so verification had to be staged in a local scratch dir).
2. Write a **codemod** (ts-morph or a careful regex script) to apply the BEFORE→AFTER transform, then hand-review the diff. The pattern is regular enough to automate but varied enough (`Querystring`/`Body`/`Params`, multi-generic like `{ Params; Body }`) to warrant review.
3. Iterate `npx tsc --noEmit` in `packages/backend` until zero errors. Expect a few handlers needing real DTO types rather than `any`.
4. Do **not** rely on `strictFunctionTypes: false` as the fix — tested, it only reduces 341 → 157 (the `unknown`-access errors remain). It could be a temporary unblock but hides real type gaps.
5. Run `npm run test` (see env note below) and commit.

---

## Also outstanding

**Frontend** (`packages/frontend`) — **15** errors, unrelated and small:
- 11 are ag-grid `cellStyle` typing (`backgroundColor: string | undefined` not assignable to `CellStyle`) in finance report pages — likely an ag-grid version bump; fix by typing the returned style objects or narrowing away `undefined`.
- Real ones: `MrlLine` missing `item` / `uom` properties (`pages/procurement/mrl/MrlFormPage.tsx`), plus a bad comparison (TS2367) and an arg-type mismatch (TS2345).

**Backend tests** — 3 of 5 suites pass (StockEngine, PoService, WorkflowService). `jwt` and `password` fail only because `src/config.ts` calls `process.exit(1)` when env vars are missing. Provide a test env (e.g. `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `REDIS_URL`) or mock config so those suites run.

---

## Already applied in this session

- `packages/backend/tsconfig.json`: removed `"prisma/seed.ts"` from `include` (fixes TS6059; seed still runs via tsx).

No other backend code was changed (speculative websocket edits were reverted).
