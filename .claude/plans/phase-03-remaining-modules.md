# Phase 3: Remaining Modules — Optimization & Cleanup

## Context
Third phase of the multi-phase code quality initiative for the NestJS barber-shop API.
Phases 1 (auth, user) and 2 (branch, category, service, order) are complete.

**Hard constraints**: No API response shape changes. No added or removed endpoints.

**10 modules in scope** (all currently imported from `src/` not `src/modules/`):
| Module | Lines | AppSuccess | console.log | Broken imports | Split? |
|--------|-------|-----------|-------------|----------------|--------|
| product | 74 | yes | no | no | no |
| complain | 108 | yes | no | no | no |
| promo-code | 84 | yes | no | `'../prisma/...'` | no |
| notification | 152 | yes | yes (4) | no | no |
| points | 170 | yes | no | `'../../src/class-type/...'` | no |
| client-packages | 207 | yes | no | `'../../src/class-type/...'` | no |
| package | 207 | yes | yes (1) | no | no |
| paymob | 180 | **no** | no | no | no |
| admin | 310 | yes | yes (1 `console.error`) | no | **yes** |
| sms | 312 | partial | yes (1) | no | **yes** |

**Same conventions as Phases 1 & 2**:
- Originals in `src/[module]/` stay **untouched** as backups
- All edits happen inside `src/modules/`
- Return raw data from services; interceptor wraps automatically
- `@ResponseMessage('...')` only when a custom message is needed
- `PartialType` always from `@nestjs/swagger`
- Swagger decorators use `ApiDoc` from `@/common/lib/swagger`

---

## Step 0 — Copy All 10 Modules + Wire App Module

Copy each module directory to `src/modules/`:
```
src/product/         → src/modules/product/
src/complain/        → src/modules/complain/
src/promo-code/      → src/modules/promo-code/
src/notification/    → src/modules/notification/
src/points/          → src/modules/points/
src/client-packages/ → src/modules/client-packages/
src/package/         → src/modules/package/
src/paymob/          → src/modules/paymob/
src/admin/           → src/modules/admin/
src/sms/             → src/modules/sms/
```

Update `src/app.module.ts` — switch all 10 imports to `./modules/`:
```typescript
import { ProductModule } from './modules/product/product.module';
import { ComplainModule } from './modules/complain/complain.module';
import { PromoCodeModule } from './modules/promo-code/promo-code.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PointsModule } from './modules/points/points.module';
import { ClientPackagesModule } from './modules/client-packages/client-packages.module';
import { PackageModule } from './modules/package/package.module';
import { PaymobModule } from './modules/paymob/paymob.module';
import { AdminModule } from './modules/admin/admin.module';
import { SmsModule } from './modules/sms/sms.module';
```

> Note: `PromoCodeService` and `NotificationService` are injected directly into `OrderModule`
> and other modules. After the move, import paths in those files must be updated (see Step 5).

---

## Step 1 — Simple Modules (product, complain, promo-code, notification, points, client-packages, package)

For each of these 7 modules, apply the same cleanup recipe:

### 1a. Fix import paths in each service
| Module | Old path | New path |
|--------|----------|----------|
| promo-code | `'../prisma/prisma.service'` | `'../../prisma/prisma.service'` |
| points | `'../../src/class-type/translation'` | `'../../class-type/translation'` |
| client-packages | `'../../src/class-type/translation'` | `'../../class-type/translation'` |
| all | `'src/utils/AppSuccess'` | remove entirely |

### 1b. Remove AppSuccess from all 7 services
Return raw data directly — interceptor wraps automatically. Remove `Promise<AppSuccess<...>>` return type annotations.

### 1c. Remove console.log statements
- `notification.service.ts` — 4 console.log calls → remove or replace with `this.logger.log()`
- `package.service.ts` — 1 `console.log(send)` → remove

### 1d. Create Swagger file using `ApiDoc`
**New file**: `src/modules/[module]/[module].swagger.ts`
One `ApiDoc` decorator per route. Import from `@/common/lib/swagger`.

### 1e. Add @ApiProperty to DTOs + PartialType fix
- Add `@ApiProperty` / `@ApiPropertyOptional` with examples to all DTO fields
- Switch any `PartialType` from `@nestjs/mapped-types` → `@nestjs/swagger`

### 1f. Create `dto/index.ts` barrel for each module

### 1g. Add @ApiTags + @ResponseMessage + swagger decorators to each controller

### 1h. Register all new DTOs in `src/main.ts` extraModels
```typescript
import * as ProductDto from './modules/product/dto';
import * as ComplainDto from './modules/complain/dto';
import * as PromoCodeDto from './modules/promo-code/dto';
import * as NotificationDto from './modules/notification/dto';
import * as PointsDto from './modules/points/dto';
import * as ClientPackagesDto from './modules/client-packages/dto';
import * as PackageDto from './modules/package/dto';
// add ...Object.values(XxxDto) to extraModels array
```

---

## Step 2 — Admin Module (split into 2 services)

### 2a. Copy `src/admin/` → `src/modules/admin/`

### 2b. Create `services/` subfolder split

**`src/modules/admin/services/admin-core.service.ts`**
- Injected: `PrismaService`
- Methods: `create`, `findAll`, `update`, `CheckPassword`
- Remove AppSuccess; return raw data

**`src/modules/admin/services/admin-analytics.service.ts`**
- Injected: `PrismaService`
- Methods: `getBarberOrdersWithCounts` (public), `AnalyticsSummary` (private), `TotalSalesPerBranch` (private), `ServiceUsageSummary` (private), `generateSlots` (private)
- Remove AppSuccess; replace `console.error` → `this.logger.error()`

**`src/modules/admin/admin.service.ts`** — thin facade
- Injects `AdminCoreService` and `AdminAnalyticsService`
- Each public method delegates in one line

### 2c. Fix imports, add Swagger + DTOs (same recipe as Step 1)

### 2d. Update `admin.module.ts` providers:
```typescript
providers: [AdminService, AdminCoreService, AdminAnalyticsService]
```

---

## Step 3 — SMS Module (split into 3 services)

### 3a. Copy `src/sms/` → `src/modules/sms/`

### 3b. Create `services/` subfolder split

**`src/modules/sms/services/sms-base.service.ts`**
- Injected: `PrismaService` + HTTP client
- Methods: `getAuthToken` (public), `sendSms` (public) — shared API communication helpers

**`src/modules/sms/services/sms-verification.service.ts`**
- Injected: `PrismaService`, `SmsBaseService`
- Methods: `sendVerificationCode`, `verifyCode`, `reSendRegistrationOTP`
- Remove AppSuccess; return raw data

**`src/modules/sms/services/sms-reset.service.ts`**
- Injected: `PrismaService`, `SmsBaseService`
- Methods: `sendResetPassword`, `verifyResetCode`, `reSendResetPasswordOTP`
- Remove AppSuccess; return raw data

**`src/modules/sms/sms.service.ts`** — thin facade + Cron
- Injects all three sub-services
- Delegates all public methods in one line each
- Keeps `@Cron` decorated `handleOtpCleanup`; remove console.log inside it

### 3c. Fix imports, add Swagger + DTOs, remove AppSuccess + console.log

### 3d. Update `sms.module.ts` providers:
```typescript
providers: [SmsService, SmsBaseService, SmsVerificationService, SmsResetService]
```

---

## Step 4 — Paymob Module

Paymob intentionally does **not** use AppSuccess (uses Express `res.sendFile()` and raw axios).
**Do not** apply the AppSuccess removal pattern here.

Apply only these targeted fixes:
- Fix empty `catch (error) {}` (line ~89) → `catch (error) { this.logger.error(...) }`
- Remove unused variable `const a = await this.points.create(...)` (line ~165)
- Add `private readonly logger = new Logger(PaymobService.name)`
- Add Swagger using `ApiDoc` (no `auth: true` for webhook endpoints)
- Add `@ApiTags('Paymob')` to controller

---

## Step 5 — Cross-Module Import Updates

After moving `promo-code` and `notification` to `src/modules/`, fix every file that imports them:

| File | Old | New |
|------|-----|-----|
| `src/modules/order/order.module.ts` | `'../../promo-code/promo-code.service'` | `'../promo-code/promo-code.service'` |
| `src/modules/order/order.module.ts` | `'../../notification/notification.service'` | `'../notification/notification.service'` |
| `src/modules/order/services/order-query.service.ts` | `'../../../promo-code/promo-code.service'` | `'../../promo-code/promo-code.service'` |
| `src/modules/order/services/order-booking.service.ts` | `'../../../promo-code/promo-code.service'` | `'../../promo-code/promo-code.service'` |
| `src/modules/order/services/order-mutation.service.ts` | `'../../../notification/notification.service'` | `'../../notification/notification.service'` |
| `src/modules/order/services/order-lifecycle.service.ts` | `'../../../notification/notification.service'` | `'../../notification/notification.service'` |
| `src/modules/order/services/order-lifecycle.service.ts` | `'../../../promo-code/promo-code.service'` | `'../../promo-code/promo-code.service'` |

Also scan all other modules under `src/modules/` for any remaining absolute `src/promo-code/` or `src/notification/` imports.

---

## Files to Create

| New File | Purpose |
|----------|---------|
| `src/modules/[x]/` (×10) | Copies of each module |
| `src/modules/[x]/[x].swagger.ts` (×10) | ApiDoc-style swagger decorators |
| `src/modules/[x]/dto/index.ts` (×10) | Barrel exports |
| `src/modules/admin/services/admin-core.service.ts` | Admin CRUD + settings |
| `src/modules/admin/services/admin-analytics.service.ts` | Admin reporting |
| `src/modules/sms/services/sms-base.service.ts` | Shared HTTP helpers |
| `src/modules/sms/services/sms-verification.service.ts` | OTP registration flow |
| `src/modules/sms/services/sms-reset.service.ts` | Password reset SMS flow |

## Files to Modify

| File | Changes |
|------|---------|
| `src/app.module.ts` | Switch all 10 imports to `./modules/` |
| `src/main.ts` | Add 7 new DTO barrel imports to `extraModels` |
| `src/modules/order/order.module.ts` | Update promo-code + notification paths |
| `src/modules/order/services/*.ts` | Update promo-code + notification paths |
| All new service files | Remove AppSuccess, fix imports, remove console.logs |
| All new controller files | Add @ApiTags, @ResponseMessage, swagger decorators |
| All new DTO files | Add @ApiProperty, fix PartialType |

**Untouched (backups)**: all originals in `src/[module]/`

---

## Verification

1. `npx tsc --noEmit` — zero TypeScript errors
2. `src/app.module.ts` — all 10 module imports point to `./modules/`
3. `GET /api/docs` — Swagger shows new tags: Product, Complain, PromoCode, Notification, Points, ClientPackages, Package, Paymob, Admin, Sms
4. No `console.log` output in server terminal
5. All endpoints return identical response shapes to before
