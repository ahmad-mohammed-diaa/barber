# Plan: Full Project Refactor & Optimize — src/modules/

## Date

2026-04-23

## Type

Refactor + Optimization

## Objective

Refactor and optimize all 15 active modules in `src/modules/` with zero API response shape changes — fixing cross-module import bugs, structural issues, stub methods, security gaps, and performance bottlenecks.

## Constraint

`.claude/plans/api-contracts.md` is the source of truth. Every response shape documented there must remain identical after all changes. No new endpoints. No field additions or removals.

---

## Legend

| Tag | Meaning |
|-----|---------|
| `R` | Refactor — structural change, import fix, split, extract, stub fix |
| `O` | Optimize — reduce DB calls, fix N+1, improve algorithm, batch ops |
| `R+O` | Both |

---

## Batch 0 — Cross-Module Wiring (SEQUENTIAL — must run before every other batch)

These are import-level bugs. Service files import legacy paths (`src/notification/`, `src/promo-code/`) instead of the active modules (`src/modules/notification/`, `src/modules/promo-code/`). Fixing these unblocks correct DI and allows Batches 3–5 to be done safely.

### Files

| File | Tag | Issue |
|------|-----|-------|
| `src/modules/order/order.module.ts` | `R` | `PromoCodeService` imported from `../../promo-code/promo-code.service` (legacy). `NotificationService` imported from `../../notification/notification.service` (legacy). Fix both to `src/modules/` paths. |
| `src/modules/order/services/order-booking.service.ts` | `R` | `PromoCodeService` imported from `../../../promo-code/promo-code.service` (legacy). Fix to modules path. |
| `src/modules/order/services/order-lifecycle.service.ts` | `R` | `NotificationService` imported from `../../../notification/notification.service` (legacy). `PromoCodeService` from `../../../promo-code/promo-code.service` (legacy). Fix both. |
| `src/modules/package/package.module.ts` | `R` | `NotificationService` imported from `src/notification/notification.service` (legacy absolute path). Fix to modules path. |

### Steps

1. In `order.module.ts`: replace both legacy imports with `src/modules/promo-code/promo-code.service` and `src/modules/notification/notification.service`.
2. In `order-booking.service.ts`: replace `PromoCodeService` import with modules path.
3. In `order-lifecycle.service.ts`: replace both legacy imports.
4. In `package.module.ts`: replace `NotificationService` import with modules path; add `NotificationModule` to `imports` array if needed, or verify the provider is available globally.
5. Run `npx tsc --noEmit` — must pass with zero new errors.

---

## Batch 1 — Independent Simple Modules (FULLY PARALLEL — 3 groups can run simultaneously)

All three groups below are independent of each other. Each group has zero cross-dependencies with the others.

---

### Batch 1-A — Security + Structural (branch, complain, static)

| File | Tag | What to do |
|------|-----|-----------|
| `src/modules/branch/branch.service.ts` | `O` | `settings.findFirst()` is called independently in `findAll()` and `findOne()` — two separate DB hits for the same table. In `findAll()`, settings is queried but `maxDaysBooking` is then nested inside each branch object (redundant). Move the settings fetch into the `Promise.all` already used in `findOne()`. In `findAll()`, fetch once and map. |
| `src/modules/branch/branch.service.ts` | `R` | `remove()` returns a string literal — this is an unimplemented stub. Implement actual `prisma.branch.delete()` or throw `NotImplementedException`. Do NOT change the HTTP status or response field names. |
| `src/modules/complain/services/complain-mutation.service.ts` | `R` | `updateComplain(id)` is a stub with no `dto` param and no body. Add `_dto` param (prefixed with `_` per ESLint config) to match the controller signature. |
| `src/modules/static/static.controller.ts` | `R` | All 6 endpoints have no auth guards — any anonymous user can modify About content and FAQs. Add `@UseGuards(AuthGuard(), RolesGuard)` + `@Roles([Role.ADMIN])` to write endpoints (POST about, POST questions, PUT about, PUT question/:id, DELETE question/:id). Keep GET `/static` public. |

---

### Batch 1-B — Security + Minor Cleanup (product, service, promo-code)

| File | Tag | What to do |
|------|-----|-----------|
| `src/modules/product/product.controller.ts` | `R` | All 5 endpoints have no auth guards — anyone can create/update/delete products. Add `@UseGuards(AuthGuard(), RolesGuard)` + `@Roles([Role.ADMIN])` to POST, PUT, DELETE. Keep GET endpoints public. |
| `src/modules/service/service.service.ts` | `R` | Minor: 114 lines, no splits needed. Verify import paths are all `src/modules/` relative — no legacy paths. |
| `src/modules/promo-code/services/promo-code-query.service.ts` | `O` | `getAllPromoCode` fetches all promo codes without pagination — verify this is intentional per API contract (it is). `validatePromoCode` does a `findUnique` by code then checks `expiredAt` and `usedCount` in application code — verify no N+1 (it's a single query, acceptable). No change needed unless query shape is wrong. |

---

### Batch 1-C — Query/Mutation Split + Analytics (category, points, admin)

| File | Tag | What to do |
|------|-----|-----------|
| `src/modules/category/category.service.ts` | `R` | 193 lines — split into `services/category-query.service.ts` (findAllCategories, findCategoryById, findOneOrFail, getUserPackages) and `services/category-mutation.service.ts` (createCategory, updateCategory, delete). Update `category.module.ts` to register both. Update `category.service.ts` facade to delegate. |
| `src/modules/category/services/category-query.service.ts` | `O` | (new file from split) `getUserPackages` fetches user with nested ClientPackages → flatMap over Translation array. The query already uses `where: { language }` on Translation — no N+1 issue. But `findAllCategories` calls `getUserPackages` inside `Promise.all` only when `user.role === 'USER'` — acceptable. |
| `src/modules/points/services/points-query.service.ts` | `O` | `findAll` includes `Translation` — verify `getTranslationNames` is called correctly on the result. If using array `.find()` on translations, no change needed (small arrays). |
| `src/modules/admin/services/admin-query.service.ts` | `O` | 209 lines. `getBarberOrdersWithCounts` runs `prisma.barber.findMany` with nested `Order` include filtered by date — this is one query, no N+1. Review whether the analytics response matches api-contracts.md exactly. The `TranslateName` import comes from `../../../../lib/lib` (root-level legacy path) — fix to `src/common/lib/lib` or relative modules path. |

---

## Batch 2 — Package Ecosystem (SEQUENTIAL within, run after Batch 0)

Package and client-packages are tightly coupled. Do package first, then client-packages.

| File | Tag | What to do |
|------|-----|-----------|
| `src/modules/package/package.controller.ts` | `R` | `DELETE /package/delete-many` uses `@Param('id') _id: string` but the param is unused — the route never makes semantic sense. Review against api-contracts.md. Fix route to `DELETE /package/:id` or implement proper delete-many with body. |
| `src/modules/package/package.controller.ts` | `R` | `PUT /package/:id` passes no body DTO — only `@Param('id') id: string`. Service stub takes no dto either. Add `@Body() dto: UpdatePackageDto` to both controller method and service stub (prefix param with `_` if unimplemented: `_dto`). |
| `src/modules/package/services/package-mutation.service.ts` | `R` | `update()` and `remove()` are unimplemented stubs (113 lines). Either implement with `prisma.package.update/delete` or throw `new NotImplementedException()`. Do NOT silently return `undefined`. |
| `src/modules/client-packages/client-packages.controller.ts` | `R` | `update()` calls `this.clientPackagesService.update(+id)` — `+id` converts UUID string to `NaN`. Remove the `+` prefix: `this.clientPackagesService.update(id)`. This is a type bug. |
| `src/modules/client-packages/services/client-packages-mutation.service.ts` | `R` | `update(id: string)` is a stub — prefix param `_id` per ESLint rule. |

---

## Batch 3 — Auth Module (PARALLEL with Batch 4)

Auth can run in parallel with Notification (Batch 4). Auth has no dependency on notification.

| File | Tag | What to do |
|------|-----|-----------|
| `src/modules/auth/services/token-operations.service.ts` | `O` | **Critical bug**: `invalidateAllUserTokens(userId)` fetches ALL tokens from DB (`findMany()` with no filter), then decodes each one in application memory to find the user's tokens. This is O(n) on the entire tokens table. Fix: store `userId` in the Token record at creation time, then `deleteMany({ where: { userId } })`. Check schema first — if `userId` column doesn't exist on Token table, add it via migration OR use `jwt.decode` only on tokens in a single `findMany({ where: { token: { contains: userId } } })` — but the correct fix is the Prisma schema fix. Document in plan that schema migration may be required. |
| `src/modules/auth/services/auth-signup.service.ts` | `R` | Role-branching logic (USER / BARBER / CASHIER / ADMIN) is nested conditionals. Extract a private `buildRoleData(dto, role)` method that returns the Prisma nested write object for the role. Reduces nesting depth without changing behavior. |
| `src/modules/auth/services/auth-password.service.ts` | `R` | Both `changePassword` and `resetPassword` return `null` — this is documented in api-contracts.md as intentional. Add a single-line comment `// intentional — clients check statusCode, not data` so future readers don't "fix" it. |
| `src/modules/auth/services/referral-code.service.ts` | `R` | Minor: verify import paths are all `src/modules/` relative. |
| `src/modules/auth/services/auth-slot.service.ts` | `R` | Minor: verify import paths. |
| `src/modules/auth/services/create-user.service.ts` | `R` | Minor: verify import paths. |

---

## Batch 4 — Notification Module (PARALLEL with Batch 3)

| File | Tag | What to do |
|------|-----|-----------|
| `src/modules/notification/notification.controller.ts` | `R` | Firebase `admin.initializeApp()` is called in the controller constructor — this throws `FirebaseAppError: Firebase App named '[DEFAULT]' already exists` on any DI re-instantiation. Move `initializeApp()` call to `notification.module.ts` in a `forRoot`-style pattern or into a singleton provider. |
| `src/modules/notification/services/notification-mutation.service.ts` | `R` | Remove all 3 `console.log` statements (lines 12, 13, 23). These log `fcmToken` and raw `user` objects to stdout in production. |
| `src/modules/notification/services/notification-mutation.service.ts` | `R` | `sendNotificationToAllUsers`: `users.map(u => prisma.user.update(...))` inside `Promise.all` creates one DB write per user — N+1 on notification history creation. Replace with `prisma.notification.createMany({ data: users.map(...) })` if the schema supports it, or batch into chunks if `createMany` is unavailable. Verify response shape is unchanged (method returns `AppSuccess(noti, ...)` where `noti` is the FCM send result — keep that). |
| `src/modules/notification/services/notification-mutation.service.ts` | `R` | Remove `console.log(error)` in `sendNotificationToAllUsers` catch block — use `Logger` like the scheduler already does. |
| `src/modules/notification/services/notificationScheduler.ts` | `R` | Remove `console.log('notification send successfully')` (line 21) and `console.log('no upcoming orders found')` (line 40) — both bypass the `Logger` already set up on the class. Replace with `this.logger.log(...)` or remove entirely. |
| `src/modules/notification/services/notificationScheduler.ts` | `O` | The loop updates each order with `reminderSent: true` individually (one `prisma.order.update` per order). After the loop, collect all notified order IDs and do a single `prisma.order.updateMany({ where: { id: { in: notifiedIds } }, data: { reminderSent: true } })`. |
| `src/modules/notification/services/notificationScheduler.ts` | `R` | The `barber` include on orders (line 32) uses `select: { id, avatar, firstName, lastName }` — but `barber` in the schema is a `Barber` model joined via the order's `barberId`. Verify the join path is correct. `Order.barber` → `Barber` which doesn't have `avatar`/`firstName`/`lastName` directly — those are on `User`. If this is producing wrong data, fix the include to `barber: { select: { id: true, user: { select: { firstName, lastName, avatar } } } }`. Trace in schema before changing. |

---

## Batch 5 — User Module (PARALLEL with Batch 3 and Batch 4)

| File | Tag | What to do |
|------|-----|-----------|
| `src/modules/user/services/user-query.service.ts` | `O` | 221 lines. `findAllUser` and `findAllClients` both run raw pagination without `prisma.$transaction` — acceptable. `processSlotInfo()` transforms Slot records — verify this helper runs once per user (it does, called inside `.map()`). No N+1. Minor: verify all import paths are `src/modules/` relative. |
| `src/modules/user/services/user-mutation.service.ts` | `R` | 273 lines. Vacation management logic (lines ~47–140) is a deeply nested block that handles: read existing slots, compare with new, call `authSlot.generateSlots`, delete old slots, create new ones. Extract this into a private `updateBarberSlots(userId, start, end, type)` method. Reduces `updateUser` to a readable sequence of steps. |
| `src/modules/user/services/user-mutation.service.ts` | `O` | `updateUser` does: `findOne(id)` → conditionally `findFirst` on slots → conditionally `generateSlots` → `user.update`. These are sequential. Group any independent reads into `Promise.all`. |
| `src/modules/user/services/user-rating.service.ts` | `O` | `rateBarber` reads current barber rating then computes a weighted average, then writes. This is a read-then-write with no transaction, creating a race condition under concurrent ratings. Wrap in `prisma.$transaction` and use `prisma.barber.update` with raw arithmetic if Prisma supports it, or lock within the transaction. |

---

## Batch 6 — Order Module (SEQUENTIAL within batch — must run after Batch 0)

Order is the most complex module. Sub-services have internal dependencies:
- `order-booking`, `order-listing`, `order-mutation`, `order-lifecycle` all depend on `order-query`
- `order-mutation` depends on `order-pricing` and `order-lifecycle`
- Do in this exact order: query → pricing → lifecycle → mutation → listing → booking

| File | Tag | What to do |
|------|-----|-----------|
| `src/modules/order/services/order-query.service.ts` | `R` | Shared selects used by all other order sub-services. Verify all selects produce fields that match api-contracts.md exactly. Verify import paths are `src/modules/` relative (no legacy). |
| `src/modules/order/services/order-pricing.service.ts` | `O` | 323 lines. `getSlots`: fetches ALL booked slots for a date+barber, then filters in JS. If slot arrays are large this is acceptable, but verify `prisma.order.findMany` includes only necessary fields. `evaluateOrder`: multiple sequential DB reads — group independent reads into `Promise.all`. |
| `src/modules/order/services/order-lifecycle.service.ts` | `R+O` | 283 lines. `completeOrder` uses `this.prisma.order.update` inside `prisma.$transaction` but also calls `this.prisma` (outer client) not the transaction `prisma` — this breaks transaction atomicity. Fix inner calls to use the transaction-scoped `prisma` parameter. |
| `src/modules/order/services/order-lifecycle.service.ts` | `R` | `paidOrder` awards loyalty points and uses packages — complex multi-step. Verify each step is inside the transaction. Trace return shape against api-contracts.md. |
| `src/modules/order/services/order-mutation.service.ts` | `R` | 341 lines. `deleteOrderServices` and `cancelDeletedServices` both do: fetch order → `comparePassword(dto.password, adminPassword)` — this admin password check is duplicated. Extract into a private `verifyAdminPassword(password)` method. |
| `src/modules/order/services/order-mutation.service.ts` | `O` | `updateOrder` computes total duration by fetching added services individually — already uses `findMany`, acceptable. Verify no sequential awaits where `Promise.all` would work. |
| `src/modules/order/services/order-listing.service.ts` | `O` | 521 lines. `getAllOrdersDateRange` maps over branches and calls `branch.Translation.find(t => t.language === language)` three times per branch (lines 60–62). Replace with a single Map lookup or destructure once. Similarly inside order mapping. |
| `src/modules/order/services/order-listing.service.ts` | `O` | `getAllOrders` fetches orders with full includes — verify no unused fields are selected. |
| `src/modules/order/services/order-booking.service.ts` | `R+O` | 600 lines — largest service file. Three extractions needed: (1) Extract `validateSlotAvailability(slot, date, barberId)` private method from `GetData` and `createOrder` — both repeat slot conflict check. (2) Extract `applyDiscounts(services, promoCode, points, user)` private method. (3) The outer `try/catch` in `GetData` re-throws `HttpException` subclasses — the catch block `if (error instanceof HttpException) throw error` is correct but verbose; keep it, just document it. |
| `src/modules/order/services/order-booking.service.ts` | `O` | The `Promise.all` in `GetData` (line 73) already parallelizes well. Verify the `createOrder` method also uses `Promise.all` for independent reads. |

---

## Batch 7 — Final Step: Module Files & Barrel Exports (LAST — run after ALL batches)

After all implementation changes, audit these files to confirm correctness. Do not run this batch until all others are verified.

| File | Tag | What to do |
|------|-----|-----------|
| `src/modules/category/category.module.ts` | `R` | After Batch 1-C split: register `CategoryQueryService` and `CategoryMutationService` as providers. Keep `CategoryService` facade as the only export. |
| `src/modules/order/order.module.ts` | `R` | After Batch 0 fixes: verify all 8 providers are registered with correct module-path imports. |
| `src/modules/package/package.module.ts` | `R` | After Batch 0 + Batch 2 fixes: verify `NotificationModule` or `NotificationService` is accessible via DI (import `NotificationModule` or verify `AuthModule` exports it globally). |
| `src/modules/*/dto/index.ts` (all 15 modules) | `R` | Verify all DTOs used in the module are re-exported. No orphaned exports. No missing exports. |
| `src/modules/notification/notification.module.ts` | `R` | After Batch 4 Firebase init fix: register Firebase as a module-level provider or use `APP_PROVIDER` pattern. Ensure `NotificationScheduler` is still reachable from `AppModule`. |

---

## Reuse & Conventions

- All Swagger files use `ApiDoc()` from `@/common/lib/swagger` — do not import from `swagger.lib.ts`
- Update stubs: unused params → prefix with `_` (ESLint: `argsIgnorePattern: '^_'`)
- Guards: always import from relative path to `guard/` at project root — `@/` alias does NOT cover `guard/`
- `prisma.$transaction`: always use the transaction-scoped `prisma` parameter inside — never `this.prisma`
- `createTranslation`/`updateTranslation`/`Translation()` helpers from `../../class-type/translation` — do not duplicate

## Performance Considerations

- **Memoization**: No — Redis caching already exists in the project; do not add ad-hoc memoization
- **Lazy loading**: N/A — this is a NestJS backend, not a frontend
- **Algorithm complexity reviewed**: Yes — two O(n) bugs identified (token invalidation, per-user notification updates)

## Guards & Edge Cases

- Response shapes in api-contracts.md must be bit-for-bit identical — trace every Prisma `select`/`include` before changing
- `order-lifecycle.completeOrder` uses `$transaction` but calls outer `this.prisma` — fix must use the transaction `prisma` param or all writes may be non-atomic
- `invalidateAllUserTokens` fix requires checking if `userId` column exists on the `Token` model in `prisma/schema.prisma` before adding `deleteMany` filter — if not present, this requires a migration
- Static + product auth guards: confirm with api-contracts.md that write endpoints were always intended to be ADMIN-only
- Firebase init must only fire once — use `admin.apps.length === 0` guard or NestJS module lifecycle hook

## How to Verify

- `npx tsc --noEmit` — zero type errors after each batch
- `npm run lint` — zero ESLint errors after each batch
- Manually test at least one read and one write endpoint per module after its batch completes
- For order batch: trace `POST /order` and `GET /order` through the call chain and confirm response shape matches api-contracts.md
- For auth batch: `POST /auth/logout` (invalidates token) then verify the O(n) fix does not break logout behavior

## Execution Order

```
Batch 0 (wiring fixes)
    ↓
Batch 1-A, 1-B, 1-C ← run in parallel
Batch 2 (package ecosystem)
Batch 3 (auth) ←─── run in parallel with each other
Batch 4 (notification)
Batch 5 (user)
    ↓
Batch 6 (order) ← sequential within
    ↓
Batch 7 (final audit)
```

## Status

[ ] Batch 0 — Wiring fixes
[ ] Batch 1-A — branch, complain, static
[ ] Batch 1-B — product, service, promo-code
[ ] Batch 1-C — category, points, admin
[ ] Batch 2 — package ecosystem
[ ] Batch 3 — auth
[ ] Batch 4 — notification
[ ] Batch 5 — user
[ ] Batch 6 — order
[ ] Batch 7 — final audit
