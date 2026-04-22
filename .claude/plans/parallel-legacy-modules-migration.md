# Plan: Migrate Legacy Modules to src/modules/

## Date

2026-04-21

## Type

Refactor

## Objective

Migrate 9 legacy root-level modules into `src/modules/`, splitting each service into sub-services (query/mutation), adding Swagger via `ApiDoc()`, and wiring a facade `{name}.service.ts` — following the auth module pattern exactly.

---

## Scope

**Modules to migrate (originals kept, NOT deleted):**
- `src/product/`          → `src/modules/product/`
- `src/complain/`         → `src/modules/complain/`
- `src/static/`           → `src/modules/static/`
- `src/promo-code/`       → `src/modules/promo-code/`
- `src/package/`          → `src/modules/package/`
- `src/client-packages/`  → `src/modules/client-packages/`
- `src/notification/`     → `src/modules/notification/`
- `src/points/`           → `src/modules/points/`
- `src/admin/`            → `src/modules/admin/`

**Excluded (do not touch):** `prisma`, `paymob`, `sms`, `mock`

**Files to modify:**
- `src/app.module.ts` — swap old imports → `src/modules/` paths (Final Step only, after all batches)

**Files to create:** full module structure under `src/modules/{name}/` for each of the 9 modules above.

---

## Work Map (Parallel Batches)

```
Total modules: 9
Batches: 3 × 3 modules
Final step: app.module.ts update

Batch 1 — Simple CRUD
  src/product/         → src/modules/product/
  src/complain/        → src/modules/complain/
  src/static/          → src/modules/static/

Batch 2 — Medium complexity
  src/promo-code/      → src/modules/promo-code/
  src/package/         → src/modules/package/
  src/client-packages/ → src/modules/client-packages/

Batch 3 — Higher complexity (Translation models, scheduler, FCM)
  src/notification/    → src/modules/notification/
  src/points/          → src/modules/points/
  src/admin/           → src/modules/admin/

Final Step (run AFTER all batches complete):
  src/app.module.ts    ← replace 9 old imports with src/modules/ paths
```

---

## Target Structure Per Module

```
src/modules/{name}/
  {name}.module.ts        — same as original; registers & exports sub-services + facade
  {name}.controller.ts    — same endpoints & guards; injects only {Name}Service facade
  {name}.swagger.ts       — ApiDoc() decorator for every controller endpoint
  {name}.service.ts       — facade; delegates only; zero business logic
  services/
    {name}-query.service.ts     — all read/find/get/validate methods
    {name}-mutation.service.ts  — all create/update/delete/send/toggle methods
    (extra files if naturally grouped, e.g. {name}-scheduler.service.ts)
  dto/                    — copied from original unchanged
```

---

## Reference Files

| What | Path |
|------|------|
| Facade pattern | `src/modules/auth/auth.service.ts` |
| Sub-service folder | `src/modules/auth/services/` |
| Swagger pattern | `src/modules/category/category.swagger.ts` |
| Module pattern | `src/modules/auth/auth.module.ts` |
| Controller pattern | `src/modules/auth/auth.controller.ts` |

---

## Per-Session Prompt (send this to each parallel session)

```
TASK: Migrate each listed legacy module from src/{name}/ into a new
src/modules/{name}/ directory following the auth module pattern exactly.
Do NOT delete the original. Do NOT modify app.module.ts.

YOUR MODULES: {batch list}

─── REFERENCE FILES ───────────────────────────────────────────────
- Facade pattern:     src/modules/auth/auth.service.ts
- Sub-service folder: src/modules/auth/services/
- Swagger pattern:    src/modules/category/category.swagger.ts
- Module pattern:     src/modules/auth/auth.module.ts
- Controller pattern: src/modules/auth/auth.controller.ts

─── CREATE THIS STRUCTURE FOR EACH MODULE ─────────────────────────
src/modules/{name}/
  {name}.module.ts       — same as original; imports sub-services
  {name}.controller.ts   — same endpoints & guards; talks only to facade
  {name}.swagger.ts      — ApiDoc() for every endpoint
  {name}.service.ts      — facade that only delegates; no logic
  services/
    {name}-query.service.ts    — all read/find/get methods
    {name}-mutation.service.ts — all write/create/update/delete methods
    (split further if methods group naturally, e.g. a separate scheduler file)
  dto/                   — copy from original unchanged

─── SERVICE SPLIT RULES ───────────────────────────────────────────
- query service    → findAll, findOne, getX, getAllX, validateX
- mutation service → create, update, delete, send, add, remove, toggle
- Scheduler methods (removeExpiredX, sendNotificationToAllUsers) → mutation
- If original has a scheduler file (notificationScheduler.ts) → copy to services/
- Facade {name}.service.ts delegates only: method() { return this.X.method() }
- Copy all business logic exactly — no changes whatsoever

─── SWAGGER RULES ─────────────────────────────────────────────────
- One exported arrow fn per controller endpoint
- import { ApiDoc } from '@/common/lib/swagger'   ← only this import
- auth: true for any endpoint behind AuthGuard
- body + extraModels for DTO body endpoints
- params for :id path params, queries for ?query params
- Never use applyDecorators or import from swagger.lib.ts

─── CONTEXT ───────────────────────────────────────────────────────
- Path alias: @/* → src/*
- PrismaService is injected globally — never new PrismaClient()
- Global interceptor wraps all responses — return raw data as-is
- Do NOT change logic, types, Prisma queries, or add missing selects
- If a module imports from another legacy module keep the original path

─── OUTPUT ────────────────────────────────────────────────────────
- List every file created with a one-line description
- List anything skipped and why
- List any cross-module dependencies found
```

---

## Final Step Prompt (run after all batches)

```
TASK: Update src/app.module.ts to replace 9 legacy module imports with
their new src/modules/ counterparts. Do NOT remove any other imports
(paymob, sms, mock, prisma stay as-is).

REPLACEMENTS:
  from: import { ProductModule }        from './product/product.module'
  to:   import { ProductModule }        from './modules/product/product.module'

  from: import { ComplainModule }       from './complain/complain.module'
  to:   import { ComplainModule }       from './modules/complain/complain.module'

  from: import { StaticModule }         from './static/static.module'
  to:   import { StaticModule }         from './modules/static/static.module'

  from: import { PromoCodeModule }      from './promo-code/promo-code.module'
  to:   import { PromoCodeModule }      from './modules/promo-code/promo-code.module'

  from: import { PackageModule }        from './package/package.module'
  to:   import { PackageModule }        from './modules/package/package.module'

  from: import { ClientPackagesModule } from './client-packages/client-packages.module'
  to:   import { ClientPackagesModule } from './modules/client-packages/client-packages.module'

  from: import { NotificationModule }   from './notification/notification.module'
  to:   import { NotificationModule }   from './modules/notification/notification.module'

  from: import { NotificationScheduler } from './notification/notificationScheduler'
  to:   import { NotificationScheduler } from './modules/notification/services/notificationScheduler'

  from: import { PointsModule }         from './points/points.module'
  to:   import { PointsModule }         from './modules/points/points.module'

  from: import { AdminModule }          from './admin/admin.module'
  to:   import { AdminModule }          from './modules/admin/admin.module'

Do not change anything else in app.module.ts.
```

---

## Implementation Steps

1. Run Batch 1 (product, complain, static) in parallel session
2. Run Batch 2 (promo-code, package, client-packages) in parallel session
3. Run Batch 3 (notification, points, admin) in parallel session
4. After all 3 batches confirmed — run Final Step (app.module.ts)
5. Run `npx tsc --noEmit` — fix any import path issues
6. Run `npm run lint` — fix any lint issues
7. Run `npm run start:dev` — verify server boots and Swagger loads

## Reuse & Conventions

- Existing logic to reuse: copy from legacy modules verbatim
- Patterns to follow: `src/modules/auth/` for structure, `src/modules/category/category.swagger.ts` for Swagger

## Guards & Edge Cases

- `notification` module has a `notificationScheduler.ts` — move to `services/` folder, update import in `app.module.ts` final step
- `admin` module has a private `generateSlots()` method — keep it in mutation service as private
- `points` module has `entities/` folder — copy it alongside `dto/`
- Cross-module imports (e.g. notification using other services) — keep pointing to original paths

## How to Verify

- `npx tsc --noEmit` passes cleanly
- `npm run lint` passes
- `npm run start:dev` boots without error
- Swagger at `/api/docs` shows all endpoints from migrated modules

## Status

[x] In Progress [x] Implemented [x] Verified