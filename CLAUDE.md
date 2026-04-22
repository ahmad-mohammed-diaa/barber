# Naeman Barber — Claude Code Rules

## Project Overview

NestJS REST API for a multi-branch barber booking platform. Clients book appointments at specific branches, choosing barbers, services, and time slots. Supports multi-role auth (USER/BARBER/CASHIER/ADMIN), loyalty points, promo codes, service packages, Paymob payments, Cloudinary image uploads, Redis caching, and Arabic/English i18n via Prisma Translation models.

## Tech Stack

- Framework: NestJS 10
- Language: TypeScript
- Package Manager: npm
- Database: PostgreSQL via Prisma ORM
- Testing: Jest (unit) + Jest e2e
- Caching: Redis via cache-manager + ioredis
- Storage: Cloudinary (multer-storage-cloudinary)
- Payments: Paymob
- Notifications: Firebase Admin (FCM)

## Key Commands

- Dev: `npm run start:dev`
- Build: `npm run build`
- Test: `npm run test`
- Lint: `npm run lint`
- Type Check: `npx tsc --noEmit`
- DB Studio: `npx prisma studio`
- DB Migrate: `npx prisma migrate dev`
- Regenerate Client: `npx prisma generate`

## Folder Structure

```
src/
  modules/          ← ALL active modules live here now
    auth/           — login, signup, password reset, slot generation
    user/           — profiles, ratings, role management
    order/          — booking lifecycle, pricing, slots (6 sub-services)
    branch/         — branch CRUD
    category/       — service categories (GENERAL | MASSAGE)
    service/        — service CRUD
    product/        — product catalog
    complain/       — user complaints
    static/         — FAQs, about content
    promo-code/     — discount codes
    package/        — service bundles
    client-packages/— purchased packages per client
    notification/   — FCM push + scheduler
    points/         — loyalty points
    admin/          — admin panel operations
  common/
    lib/swagger.ts  — ApiDoc() helper (use for all Swagger decorators)
    lib/lib.ts      — getTranslationNames(), getDayRange()
    decorators/     — @ResponseMessage(), @Roles(), @UserData()
    interceptors/   — TransformResponseInterceptor (global AppSuccess wrapper)
  config/
    multer.config.ts — Cloudinary upload config
  [legacy — do not touch]
    paymob/ sms/ mock/ prisma/   ← excluded from migration; use originals
prisma/
  schema.prisma     — DB schema (User, Barber, Cashier, Client, Order, Branch, …)
guard/              ← ROOT LEVEL — not under src/ — use relative imports
  auth.guard.ts
  role.guard.ts
decorators/         ← ROOT LEVEL — not under src/ — use relative imports
  roles.decorator.ts
  user.decorator.ts
  accept.language.ts
.claude/
  plans/            — active and completed phase plans
```

## Module Structure Convention

Every module under `src/modules/` follows this pattern (reference: `auth` module):

```
{name}/
  {name}.module.ts        — registers sub-services + facade; exports facade only
  {name}.controller.ts    — injects only {Name}Service facade; applies swagger decorators
  {name}.swagger.ts       — ApiDoc() for every endpoint
  {name}.service.ts       — facade; delegates to sub-services; zero business logic
  services/
    {name}-query.service.ts    — all read/find/get methods
    {name}-mutation.service.ts — all create/update/delete/send methods
    (+ extra files if naturally grouped, e.g. notificationScheduler.ts)
  dto/                    — DTOs for this module
```

## Code Conventions

- All Swagger decorator files use `ApiDoc()` from `@/common/lib/swagger` — never `applyDecorators` + `swagger.lib.ts`
- All controllers return raw data; `TransformResponseInterceptor` wraps responses in `AppSuccess` — never return `{ data, message, statusCode }` manually
- Update DTOs extend `PartialType(CreateXDto)` — never duplicate fields
- Guards: `@UseGuards(AuthGuard(), RolesGuard)` + `@Roles([Role.X])` for protected; `OptionalAuthGuard` for optional auth; no guard for public
- File uploads: `FileInterceptor('file', multerConfig('folder'))` — max 5 MB, images only
- Prisma: inject `PrismaService` — never `new PrismaClient()`; always select only needed fields; use `prisma.$transaction` for multi-step writes
- i18n: use `Translation`/`TranslationDes` models with `EN | AR` enum; resolve with `getTranslationNames()`
- Path aliases: `@/*` → `src/*` only — does NOT cover root-level `guard/` or `decorators/`

## Known Gotchas & Fragile Areas

- **Guard and decorator imports** — `guard/` and `decorators/` are at project ROOT, not inside `src/`. The `@/` alias maps to `src/`, so `@/guard/auth.guard` will NOT resolve. Always use relative paths: `../../../guard/auth.guard` from `src/modules/{name}/` depth.
- **`ApiDoc()` does not support response-code decorators** — omit `ApiSuccessResponse`, `ApiNotFoundResponse` etc.
- **`extraModels` is required** whenever `body` is passed to `ApiDoc()`
- **`app.module.ts` must be updated** when adding any new module
- **`notification` scheduler** — `NotificationScheduler` is registered as a provider in `AppModule` directly (not only via `NotificationModule`). Its import path is `src/modules/notification/services/notificationScheduler`.
- **`package` module** depends on `NotificationService` from the legacy `src/notification/` — it imports the original directly. When legacy notification is eventually deleted, update `PackageModule` providers.
- **`client-packages`, `product`, `points`** import translation helpers from `src/class-type/translation` — keep this path as-is.
- **`admin` query service** imports `TranslateName` from `lib/lib.ts` at root level — path from `src/modules/admin/services/` is `../../../../lib/lib`.
- **Unused stub parameters** — legacy modules have unimplemented `update()`/`remove()` stubs with unused params. Prefix with `_` (e.g. `_updatePointDto`) — `.eslintrc.js` has `argsIgnorePattern: '^_'` configured.
- **`claude` CLI cannot be invoked as a bash subprocess on Windows** — git-bash is not on PATH in that context. Use the Agent tool directly for parallel workstreams instead.

## Project-Specific Rules

- Never modify: `src/generated/*`, `database/migrations/*`, `.env.production`
- Never touch: `src/paymob/`, `src/sms/`, `src/mock/`, `src/prisma/` — excluded from migration
- Always check before editing: `.claude/plans/` — active phase plans constrain scope
- When adding a module to `src/modules/`, always update `app.module.ts` to replace the legacy import (not add alongside it)
- Legacy modules in root `src/` are kept as-is (originals not deleted) — `app.module.ts` is the source of truth for which version is active

## Architecture Decisions

- **Facade pattern for services** — `{name}.service.ts` contains zero business logic; it only delegates to sub-services. Controllers import only the facade. This keeps controllers thin and sub-services independently testable.
- **Query/mutation split** — read methods → `{name}-query.service.ts`; write methods → `{name}-mutation.service.ts`. Scheduler `@Cron` methods go in mutation service. Separate scheduler files (e.g. `notificationScheduler.ts`) stay as their own file in `services/`.
- **Originals kept during migration** — legacy modules at `src/{name}/` are never deleted during the migration phase. `app.module.ts` import is swapped to activate the new version. This allows safe rollback.

## Status

Bootstrapped: 2026-04-21
Last updated: 2026-04-21
