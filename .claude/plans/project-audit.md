# Naeman Barber — Full Project Audit

> Generated: 2026-04-21 | Status: COMPLETE
> All data read directly from source files — not inferred.

---

## Table of Contents

1. [File Map](#1-file-map)
2. [API Endpoints](#2-api-endpoints)
3. [Module Components & Responsibilities](#3-module-components--responsibilities)
4. [Utilities & Infrastructure](#4-utilities--infrastructure)
5. [Duplications](#5-duplications)
6. [Files Over 150 Lines](#6-files-over-150-lines)
7. [Files With No Tests](#7-files-with-no-tests)

---

## 1. File Map

### Active Modules — `src/modules/` (15 modules)

#### auth

| File                                   | Purpose                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `auth.module.ts`                       | `@Global` module; registers all 7 sub-services; exports `AuthService`, `AuthSlotService`, `TokenOperationsService` |
| `auth.controller.ts`                   | 6 endpoints: signup, login, logout, referral-code, change-password, reset-password                                 |
| `auth.service.ts`                      | Facade; delegates to 5 sub-services; also exposes `verifyToken`/`generateToken` for guards                         |
| `auth.swagger.ts`                      | `ApiDoc()` decorators for all 6 auth endpoints                                                                     |
| `services/auth-signup.service.ts`      | Full signup flow: hash password, create User+role record, generate token                                           |
| `services/auth-login.service.ts`       | Login (bcrypt compare) + logout (invalidate token)                                                                 |
| `services/auth-password.service.ts`    | `changePassword` and `resetPassword` (sets DEFAULT_PASSWORD)                                                       |
| `services/auth-slot.service.ts`        | Validates branch exists, calls `generateSlots`, persists time slots                                                |
| `services/create-user.service.ts`      | Low-level `prisma.user.create` with role-specific nested write                                                     |
| `services/referral-code.service.ts`    | Validates and applies referral codes; awards points                                                                |
| `services/token-operations.service.ts` | `generateToken`, `verifyToken`, `invalidateToken`, `invalidateAllUserTokens` using `jsonwebtoken`                  |
| `dto/auth-register-dto.ts`             | `RegisterDto` + `Vacation` class (114 lines)                                                                       |
| `dto/auth-login-dto.ts`                | `LoginDto`                                                                                                         |
| `dto/change-password.dto.ts`           | `ChangePasswordDto`                                                                                                |
| `dto/reset-password.dto.ts`            | `ResetPasswordDto`                                                                                                 |
| `dto/referral-code.dto.ts`             | `ReferralCodeDto`                                                                                                  |
| `dto/index.ts`                         | Re-exports all auth DTOs                                                                                           |

#### user

| File                                | Purpose                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `user.module.ts`                    | Registers 3 sub-services; exports `UserService`                                                   |
| `user.controller.ts`                | 10 endpoints (all require `AuthGuard()`)                                                          |
| `user.service.ts`                   | Facade; delegates to 3 sub-services                                                               |
| `user.swagger.ts`                   | `ApiDoc()` for all user endpoints                                                                 |
| `services/user-query.service.ts`    | `findAllUser`, `findAllClients`, `findOneUser`, `currentUser` (221 lines)                         |
| `services/user-mutation.service.ts` | `updateUser`, `updateBarberAvailability`, `unbanUser`, `deleteUser`, `deleteEmployee` (273 lines) |
| `services/user-rating.service.ts`   | `rateBarber`: validates order ownership, updates barber avg rating                                |
| `dto/find-all-users.dto.ts`         | `role?`, `page?`, `pageSize?`                                                                     |
| `dto/find-all-clients.dto.ts`       | `page?`, `pageSize?`, `phone?`                                                                    |
| `dto/user-update-dto.ts`            | `extends PartialType(RegisterDto)` + `vacationsToDelete?: string[]`                               |
| `dto/rate-barber.dto.ts`            | `barberId`, `orderId`, `rating` (1–5)                                                             |
| `dto/index.ts`                      | Re-exports all user DTOs                                                                          |

#### order (most complex — 6 sub-services)

| File                                  | Purpose                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order.module.ts`                     | Registers 6 sub-services + `PromoCodeService` + `NotificationService` (legacy imports)                                                                  |
| `order.controller.ts`                 | 18 endpoints (279 lines)                                                                                                                                |
| `order.service.ts`                    | Facade; delegates to 6 sub-services                                                                                                                     |
| `order.swagger.ts`                    | `ApiDoc()` for all 18 order endpoints (136 lines)                                                                                                       |
| `services/order-booking.service.ts`   | `createOrder` + `GetData` (preview/evaluate before booking) — 600 lines                                                                                 |
| `services/order-listing.service.ts`   | `getAllOrders`, `getAllOrdersDateRange`, `GetBarberOrders`, `getCashierOrders`, `billOrders` — 521 lines                                                |
| `services/order-query.service.ts`     | Low-level shared Prisma selects reused by other order services                                                                                          |
| `services/order-mutation.service.ts`  | `updateOrder`, `deleteOrderServices`, `cancelDeletedServices`, `updateOrderServices`, `generateSlot` — 341 lines                                        |
| `services/order-pricing.service.ts`   | `evaluateOrder`, `getSlots`, `getOrderById`, `getNonSelectedServices` — 323 lines                                                                       |
| `services/order-lifecycle.service.ts` | `paidOrder`, `cancelOrder`, `startOrder`, `completeOrder` — 283 lines                                                                                   |
| `dto/create-order.dto.ts`             | Full booking DTO: userId?, phone?, date, slot, barberId?, service[], packages[], branchId?, note?, points?, promoCode?, usedPackage?, status?, booking? |
| `dto/update-order.dto.ts`             | `extends PartialType(CreateOrderDto)` + `add[]`, `remove[]`, `addPackage[]`, `removePackage[]`                                                          |
| `dto/update-order-services.dto.ts`    | `serviceToDelete: string[]`                                                                                                                             |
| `dto/paid-order-body.dto.ts`          | `discount?`, `points?`                                                                                                                                  |
| `dto/get-slots-query.dto.ts`          | `date`, `barberId?`, `totalDuration?`                                                                                                                   |
| `dto/generate-slot-body.dto.ts`       | `start` (0–23), `end` (0–23)                                                                                                                            |
| `dto/barber-orders-query.dto.ts`      | `fromDate?`, `toDate?`                                                                                                                                  |
| `dto/date-range-query.dto.ts`         | Date range filter                                                                                                                                       |
| `dto/index.ts`                        | Re-exports all order DTOs                                                                                                                               |

#### admin

| File                                 | Purpose                                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `admin.module.ts`                    | Registers 2 sub-services                                                                                                               |
| `admin.controller.ts`                | 5 endpoints; all require `AuthGuard() + RolesGuard`                                                                                    |
| `admin.service.ts`                   | Facade → `AdminQueryService` + `AdminMutationService`                                                                                  |
| `admin.swagger.ts`                   | `ApiDoc()` for all admin endpoints                                                                                                     |
| `services/admin-query.service.ts`    | `findAll` (settings), `getBarberOrdersWithCounts` (analytics) — 209 lines                                                              |
| `services/admin-mutation.service.ts` | `create` (settings), `update` (settings), `CheckPassword` — 111 lines                                                                  |
| `dto/create-admin.dto.ts`            | `PointsPercentage`, `referralPoints`, `pointLimit`, `canceledOrder`, `slotDuration`, `maxDaysBooking`, `maxBookingsPerDay`, `password` |
| `dto/update-admin.dto.ts`            | `extends PartialType(CreateAdminDto)`                                                                                                  |

#### branch

| File                       | Purpose                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `branch.module.ts`         | Single service (no sub-service split)                                  |
| `branch.controller.ts`     | 5 endpoints: POST, GET, GET/:id, PUT/:id, DELETE/:id                   |
| `branch.service.ts`        | All branch logic inline (128 lines) — no query/mutation split          |
| `branch.swagger.ts`        | `ApiDoc()` for all branch endpoints                                    |
| `dto/create-branch.dto.ts` | `location`, `phone`, `latitude`, `longitude`, `rate?`, `Translation[]` |
| `dto/update-branch.dto.ts` | `extends PartialType(CreateBranchDto)`                                 |
| `dto/index.ts`             | Re-exports                                                             |

#### category

| File                         | Purpose                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `category.module.ts`         | Single service                                             |
| `category.controller.ts`     | 5 endpoints                                                |
| `category.service.ts`        | All category logic inline — 193 lines                      |
| `category.swagger.ts`        | Swagger docs                                               |
| `dto/create-category.dto.ts` | `available?`, `type?` (CategoryType enum), `Translation[]` |
| `dto/update-category.dto.ts` | `extends PartialType(CreateCategoryDto)`                   |
| `dto/index.ts`               | Re-exports                                                 |

#### service

| File                        | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `service.module.ts`         | Single service                                                   |
| `service.controller.ts`     | 5 endpoints (GET, GET/:id, POST, PUT/:id, PUT/:id/status)        |
| `service.service.ts`        | All service logic inline — 114 lines                             |
| `service.swagger.ts`        | Swagger docs                                                     |
| `dto/create-service.dto.ts` | `price`, `duration`, `categoryId`, `available?`, `Translation[]` |
| `dto/update-service.dto.ts` | `extends PartialType(CreateServiceDto)`                          |
| `dto/service-status.dto.ts` | `available: boolean`                                             |
| `dto/index.ts`              | Re-exports                                                       |

#### product

| File                                   | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| `product.module.ts`                    | Registers query + mutation sub-services                   |
| `product.controller.ts`                | 5 endpoints — **no auth guards at all**                   |
| `product.service.ts`                   | Facade → `ProductQueryService` + `ProductMutationService` |
| `product.swagger.ts`                   | Swagger docs                                              |
| `services/product-query.service.ts`    | `getAllProducts`, `getProductById`                        |
| `services/product-mutation.service.ts` | `createProduct`, `updateProduct`, `deleteProduct`         |
| `dto/create-product.dto.ts`            | `productImg`, `price`, `available`, `Translation[]`       |
| `dto/update-product.dto.ts`            | `extends PartialType(CreateProductDto)`                   |

#### package

| File                                   | Purpose                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `package.module.ts`                    | Registers query + mutation + `NotificationService` (from legacy `src/notification/`)      |
| `package.controller.ts`                | 5 endpoints; `update` is stub (no body param), `remove` uses wrong route                  |
| `package.service.ts`                   | Facade → `PackageQueryService` + `PackageMutationService`                                 |
| `package.swagger.ts`                   | Swagger docs                                                                              |
| `services/package-query.service.ts`    | `findAll`, `findOne`                                                                      |
| `services/package-mutation.service.ts` | `create`, `update` (stub), `remove` (stub) — 113 lines                                    |
| `dto/create-package.dto.ts`            | `serviceIds[]`, `price`, `count?`, `type?` (PackagesStatus), `expiresAt`, `Translation[]` |
| `dto/update-package.dto.ts`            | `extends PartialType(CreatePackageDto)`                                                   |

#### promo-code

| File                                      | Purpose                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `promo-code.module.ts`                    | Registers query + mutation sub-services                    |
| `promo-code.controller.ts`                | 4 endpoints: POST, GET, POST /valid-promo-code, DELETE/:id |
| `promo-code.service.ts`                   | Facade                                                     |
| `promo-code.swagger.ts`                   | Swagger docs                                               |
| `services/promo-code-query.service.ts`    | `getAllPromoCode`, `validatePromoCode`                     |
| `services/promo-code-mutation.service.ts` | `createPromoCode`, `deletePromoCode`                       |
| `dto/create-promo-code.dto.ts`            | `code?`, `discount`, `type` (PromoType), `expiredAt`       |
| `dto/update-promo-code.dto.ts`            | `extends PartialType(CreatePromoCodeDto)`                  |

#### client-packages

| File                                           | Purpose                                       |
| ---------------------------------------------- | --------------------------------------------- |
| `client-packages.module.ts`                    | Registers query + mutation sub-services       |
| `client-packages.controller.ts`                | 5 endpoints; `update` and `remove` are stubs  |
| `client-packages.service.ts`                   | Facade                                        |
| `client-packages.swagger.ts`                   | Swagger docs                                  |
| `services/client-packages-query.service.ts`    | `findAll`, `findOne` — 119 lines              |
| `services/client-packages-mutation.service.ts` | `create`, `update` (stub), `remove`           |
| `dto/create-client-package.dto.ts`             | `type: PackagesStatus`                        |
| `dto/update-client-package.dto.ts`             | `extends PartialType(CreateClientPackageDto)` |

#### complain

| File                                    | Purpose                                             |
| --------------------------------------- | --------------------------------------------------- |
| `complain.module.ts`                    | Registers query + mutation sub-services             |
| `complain.controller.ts`                | 5 endpoints                                         |
| `complain.service.ts`                   | Facade                                              |
| `complain.swagger.ts`                   | Swagger docs                                        |
| `services/complain-query.service.ts`    | `getAllComplains`, `findOne`                        |
| `services/complain-mutation.service.ts` | `createComplain`, `updateComplain` (stub), `remove` |
| `dto/create-complain.dto.ts`            | `message: string`                                   |
| `dto/update-complain.dto.ts`            | `extends PartialType(CreateComplainDto)`            |

#### notification

| File                                        | Purpose                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `notification.module.ts`                    | Registers query + mutation + scheduler                                               |
| `notification.controller.ts`                | 4 endpoints; Firebase `initializeApp` called in constructor (design flaw)            |
| `notification.service.ts`                   | Facade                                                                               |
| `notification.swagger.ts`                   | Swagger docs                                                                         |
| `services/notification-query.service.ts`    | `getNotification`                                                                    |
| `services/notification-mutation.service.ts` | `setFCMToken`, `sendNotification`, `sendNotificationToAllUsers` — 140 lines          |
| `services/notificationScheduler.ts`         | `@Cron` scheduler for appointment reminders; also registered in `AppModule` directly |
| `dto/create-notification.dto.ts`            | Notification create DTO                                                              |
| `dto/update-notification.dto.ts`            | `extends PartialType(CreateNotificationDto)`                                         |

#### points

| File                                  | Purpose                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `points.module.ts`                    | Registers query + mutation sub-services                                         |
| `points.controller.ts`                | 6 endpoints: POST, GET, POST /purchase/:pointId, GET/:id, PATCH/:id, DELETE/:id |
| `points.service.ts`                   | Facade                                                                          |
| `points.swagger.ts`                   | Swagger docs                                                                    |
| `services/points-query.service.ts`    | `findAll`, `findOne`                                                            |
| `services/points-mutation.service.ts` | `createPoints`, `purchasePoint`, `update`, `remove` — 132 lines                 |
| `dto/create-point.dto.ts`             | `price`, `points`, `Translation[]`                                              |
| `dto/update-point.dto.ts`             | `extends PartialType(CreatePointDto)`                                           |
| `entities/point.entity.ts`            | Unused entity class                                                             |

#### static

| File                                  | Purpose                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `static.module.ts`                    | Registers query + mutation sub-services                                                                                  |
| `static.controller.ts`                | 6 endpoints: POST /about, POST /questions, GET, PUT /about, PUT /question/:id, DELETE /question/:id — **no auth guards** |
| `static.service.ts`                   | Facade                                                                                                                   |
| `static.swagger.ts`                   | Swagger docs                                                                                                             |
| `services/static-query.service.ts`    | `getStatic`                                                                                                              |
| `services/static-mutation.service.ts` | `createAbout`, `createQuestions`, `updateAbout`, `updateQuestion`, `deleteQuestion` — 134 lines                          |
| `dto/create-static.dto.ts`            | `CreateAboutDto` (content, location, time), `CreateQuestionDto` (question, answer)                                       |
| `dto/update-static.dto.ts`            | Update variant                                                                                                           |

---

### Legacy Modules — `src/` (kept as-is, NOT active in AppModule)

These modules are **inactive** — `app.module.ts` imports from `src/modules/` for all of these. Files exist on disk but do nothing at runtime.

| Module          | Path                   | Notes                                                                    |
| --------------- | ---------------------- | ------------------------------------------------------------------------ |
| auth            | `src/auth/`            | Single monolithic `auth.service.ts` (436 lines)                          |
| user            | `src/user/`            | Monolithic `user.service.ts` (699 lines)                                 |
| order           | `src/order/`           | Monolithic `order.service.ts` (2565 lines) — largest file in repo        |
| branch          | `src/branch/`          | Legacy service                                                           |
| category        | `src/category/`        | Legacy service (273 lines)                                               |
| service         | `src/service/`         | Legacy service                                                           |
| product         | `src/product/`         | Legacy service                                                           |
| package         | `src/package/`         | Legacy service (207 lines)                                               |
| promo-code      | `src/promo-code/`      | Legacy service                                                           |
| client-packages | `src/client-packages/` | Legacy service (207 lines)                                               |
| complain        | `src/complain/`        | Legacy service                                                           |
| points          | `src/points/`          | Legacy service (170 lines)                                               |
| notification    | `src/notification/`    | Legacy service (152 lines); `notificationScheduler.ts` at root of module |
| admin           | `src/admin/`           | Legacy service (310 lines)                                               |
| static          | `src/static/`          | Legacy service (148 lines)                                               |

---

### Non-Migrated Modules — `src/` (still ACTIVE in AppModule)

| Module | Path          | Notes                                                                  |
| ------ | ------------- | ---------------------------------------------------------------------- |
| paymob | `src/paymob/` | Paymob payment gateway integration (180 lines service)                 |
| sms    | `src/sms/`    | SMS sending (312 lines service)                                        |
| mock   | `src/mock/`   | Mock/seed data module (687 lines service); still imported in AppModule |

---

### Infrastructure Files

| File                                                        | Purpose                                                                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `src/app.module.ts`                                         | Root module; imports all 15 active modules + paymob + sms + mock; registers `NotificationScheduler` + `TransformResponseInterceptor` globally |
| `src/main.ts`                                               | Bootstrap; registers global validation pipe, `NotFoundFilter`                                                                                 |
| `src/token.service.ts`                                      | Standalone token service at root level (legacy, likely unused)                                                                                |
| `src/prisma/prisma.module.ts`                               | Global Prisma module                                                                                                                          |
| `src/prisma/prisma.service.ts`                              | `PrismaClient` wrapper with `onModuleInit`                                                                                                    |
| `src/config/multer.config.ts`                               | Cloudinary upload config factory — 5 MB limit, jpg/jpeg/png only                                                                              |
| `src/config/cacheManager.module.ts`                         | Redis cache manager module                                                                                                                    |
| `guard/auth.guard.ts`                                       | JWT + API-key auth guard factory; sets `req.user` and `req.token`; `AuthGuard(false)` = optional                                              |
| `guard/role.guard.ts`                                       | Checks `req.user.role` against `@Roles()` metadata                                                                                            |
| `guard/optional-auth.guard.ts`                              | Always returns `true`; sets user if token valid (used in some legacy code)                                                                    |
| `guard/accept.language.ts`                                  | Accept-Language interceptor (legacy/unused at root guard level)                                                                               |
| `decorators/roles.decorator.ts`                             | `@Roles(Role[])` → `SetMetadata('roles', roles)`                                                                                              |
| `decorators/user.decorator.ts`                              | `@UserData('user'                                                                                                                             | 'token')` param decorator |
| `decorators/accept.language.ts`                             | `@Lang()` param decorator — reads `accept-language` header, defaults to `EN`                                                                  |
| `src/common/decorators/response-message.decorator.ts`       | `@ResponseMessage(msg)` → `SetMetadata('response_message', msg)`                                                                              |
| `src/common/interceptors/transform-response.interceptor.ts` | Global interceptor: wraps raw returns in `AppSuccess`; passes through if response already has `message` key                                   |
| `src/common/lib/swagger.ts`                                 | `ApiDoc()` factory — the single correct way to add Swagger in this project                                                                    |
| `src/common/lib/swagger.lib.ts`                             | **Legacy** swagger helper — should not be used in new modules                                                                                 |
| `src/common/lib/lib.ts`                                     | `getTranslationNames(translations, lang)` → `{nameEN, nameAR, name}`; `getDayRange(date)` → `{startOfDay, endOfDay}`                          |
| `src/common/dto/translation.ts`                             | `TranslationType` class + `UpdateTranslationDto`                                                                                              |
| `src/utils/AppSuccess.ts`                                   | Response shape: `{data, message, statusCode}`                                                                                                 |
| `src/utils/constants.ts`                                    | `DEFAULT_PASSWORD = '123456'`                                                                                                                 |
| `src/utils/generate.ts`                                     | `Random(length)` — generates random alphanumeric code using `crypto.randomInt`                                                                |
| `src/utils/generateSlot.ts`                                 | `generateSlots(prisma, start, end)` — reads `slotDuration` from settings, generates 12h-format time strings; handles midnight wraparound      |
| `src/utils/lib.ts`                                          | `hashedPassword`, `comparePassword` (bcrypt wrappers); `getOrderDateTime(order)` — parses slot string to `Date`                               |
| `src/utils/not-found.filter.ts`                             | `@Catch(NotFoundException)` — returns 404 JSON with branch name                                                                               |
| `src/class-type/translation.ts`                             | `createTranslation`, `updateTranslation`, `Translation()`, `translationDes()` helpers + `translationDto` class                                |
| `src/class-type/users.ts`                                   | User-related type helpers                                                                                                                     |
| `lib/lib.ts`                                                | Root-level lib (legacy path used by some legacy services)                                                                                     |

---

## 2. API Endpoints

All responses are wrapped in `AppSuccess` unless the service returns an object with a `message` key already (auth responses return raw `{data, token, message, statusCode}`).

**Global response envelope:**

```typescript
{ "data": <T>, "message": "string", "statusCode": 200 }
```

**Auth responses (bypass envelope):**

```typescript
{ "data": <User without password>, "token": "jwt-string", "message": "string", "statusCode": 201 }
```

---

### Auth — `POST/PATCH /auth`

| Method | Path                        | Guard                                         | Request                                   | Response data                                   |
| ------ | --------------------------- | --------------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| POST   | `/auth/signup`              | Public                                        | Body: `RegisterDto` + File: avatar        | `User` (no password) + `token` (USER role only) |
| POST   | `/auth/login`               | Public                                        | Body: `LoginDto` { phone, password }      | `User` (no password) + `token`                  |
| POST   | `/auth/logout`              | `AuthGuard()`                                 | —                                         | `null`                                          |
| POST   | `/auth/referral-code`       | Public                                        | Body: `{ referralCode: string }`          | referral code record                            |
| PATCH  | `/auth/change-password/:id` | `AuthGuard()`                                 | Param: UUID, Body: `{ password: string }` | updated user                                    |
| PATCH  | `/auth/reset-password`      | `AuthGuard() + RolesGuard` `[ADMIN, CASHIER]` | Body: `{ phone: string }`                 | updated user                                    |

---

### User — `GET/PUT/PATCH/DELETE /user` (all require `AuthGuard()`)

| Method | Path                              | Guard         | Request                                          | Response data               |
| ------ | --------------------------------- | ------------- | ------------------------------------------------ | --------------------------- |
| PUT    | `/user/unban`                     | `AuthGuard()` | Body: `{ number: string }`                       | updated user                |
| GET    | `/user`                           | `AuthGuard()` | Query: `{ role?, page?, pageSize? }`             | paginated users list        |
| GET    | `/user/clients`                   | `AuthGuard()` | Query: `{ page?, pageSize?, phone? }`            | paginated clients list      |
| GET    | `/user/current/profile`           | `AuthGuard()` | — (from token)                                   | current user with relations |
| GET    | `/user/:id`                       | `AuthGuard()` | Param: UUID                                      | single user                 |
| PUT    | `/user/:id`                       | `AuthGuard()` | Param: UUID, Body: `UserUpdateDto`, File: avatar | updated user                |
| PATCH  | `/user/barber-availability/:id`   | `AuthGuard()` | Param: UUID                                      | toggled barber availability |
| DELETE | `/user/deleteAccount`             | `AuthGuard()` | — (from token)                                   | deleted user                |
| DELETE | `/user/deleteEmployeeAccount/:id` | `AuthGuard()` | Param: UUID                                      | deleted employee            |
| POST   | `/user/rate-barber`               | `AuthGuard()` | Body: `{ barberId, orderId, rating(1-5) }`       | rating result               |

---

### Order — `/order`

| Method | Path                                 | Guard                           | Roles                  | Request                                          | Response data                   |
| ------ | ------------------------------------ | ------------------------------- | ---------------------- | ------------------------------------------------ | ------------------------------- |
| GET    | `/order`                             | `AuthGuard() + RolesGuard`      | any                    | Header: lang                                     | user's orders list              |
| GET    | `/order/getAllOrders`                | `AuthGuard() + RolesGuard`      | ADMIN, CASHIER         | Query: `fromDate?`, `toDate?`                    | orders in date range            |
| GET    | `/order/barber-orders`               | `AuthGuard() + RolesGuard`      | BARBER                 | Query: `fromDate?`, `toDate?`                    | barber's orders                 |
| GET    | `/order/categories/:id`              | `AuthGuard() + RolesGuard`      | any                    | Param: orderId, Header: lang                     | non-selected services for order |
| GET    | `/order/cashier`                     | `AuthGuard() + RolesGuard`      | CASHIER                | Query: `fromDate?`, `toDate?`                    | cashier's orders                |
| GET    | `/order/paid-orders`                 | `AuthGuard() + RolesGuard`      | ADMIN, CASHIER         | Query: `date?`                                   | paid orders for date            |
| PUT    | `/order/delete-order-services/:id`   | `AuthGuard() + RolesGuard`      | ADMIN                  | Param: id, Body: `{ password: string }`          | updated order                   |
| PUT    | `/order/cancel-deleted-services/:id` | `AuthGuard() + RolesGuard`      | ADMIN                  | Param: id, Body: `{ password: string }`          | updated order                   |
| PUT    | `/order/update-order-services/:id`   | `AuthGuard() + RolesGuard`      | ADMIN, CASHIER         | Param: id, Body: `{ serviceToDelete: string[] }` | updated order                   |
| GET    | `/order/evaluate-order/:id`          | `AuthGuard() + RolesGuard`      | ADMIN, CASHIER         | Param: id, Query: `discount?`, `points?`         | order pricing breakdown         |
| PUT    | `/order/paid-order/:id`              | `AuthGuard() + RolesGuard`      | ADMIN, CASHIER         | Param: id, Body: `{ discount?, points? }`        | paid order                      |
| PUT    | `/order/cancel-order/:id`            | `AuthGuard() + RolesGuard`      | any                    | Param: id                                        | cancelled order                 |
| PUT    | `/order/start-order/:id`             | `AuthGuard() + RolesGuard`      | ADMIN, BARBER          | Param: id                                        | started order                   |
| PUT    | `/order/complete-order/:id`          | `AuthGuard() + RolesGuard`      | ADMIN, BARBER          | Param: id                                        | completed order                 |
| POST   | `/order/OrderDetails`                | `AuthGuard(false) + RolesGuard` | optional               | Body: `CreateOrderDto`, Header: lang             | order preview/pricing           |
| GET    | `/order/slots`                       | `AuthGuard(false) + RolesGuard` | optional               | Query: `date`, `barberId?`, `totalDuration?`     | available time slots array      |
| PUT    | `/order/:id`                         | `AuthGuard() + RolesGuard`      | ADMIN, CASHIER, BARBER | Param: id, Body: `UpdateOrderDto`                | updated order                   |
| GET    | `/order/:id`                         | `AuthGuard() + RolesGuard`      | any                    | Param: id                                        | single order                    |
| POST   | `/order`                             | `AuthGuard() + RolesGuard`      | any                    | Body: `CreateOrderDto`, Header: lang             | created order                   |
| POST   | `/order/generate-slot`               | `AuthGuard() + RolesGuard`      | ADMIN                  | Body: `{ start: 0-23, end: 0-23 }`               | generated slot strings array    |

---

### Admin — `/admin` (all require `AuthGuard() + RolesGuard`)

| Method | Path                    | Roles          | Request                       | Response data                   |
| ------ | ----------------------- | -------------- | ----------------------------- | ------------------------------- |
| POST   | `/admin`                | ADMIN          | Body: `CreateAdminDto`        | created settings                |
| GET    | `/admin`                | ADMIN          | —                             | settings object                 |
| GET    | `/admin/analytics`      | ADMIN, CASHIER | Query: `fromDate?`, `toDate?` | barber order counts + analytics |
| PUT    | `/admin`                | ADMIN          | Body: `UpdateAdminDto`        | updated settings                |
| POST   | `/admin/check-password` | ADMIN, CASHIER | Body: `{ password: string }`  | boolean                         |

---

### Branch — `/branch`

| Method | Path          | Guard                      | Roles    | Request                                           | Response data                                |
| ------ | ------------- | -------------------------- | -------- | ------------------------------------------------- | -------------------------------------------- |
| POST   | `/branch`     | `AuthGuard() + RolesGuard` | ADMIN    | Body: `CreateBranchDto`, File: image              | `{ name, ...branch }`                        |
| GET    | `/branch`     | `AuthGuard(false)`         | optional | Header: lang                                      | `{ branches: [...], maxDaysBooking }`        |
| GET    | `/branch/:id` | `AuthGuard(false)`         | optional | Param: UUID, Query: `type?`, Header: lang         | branch + barbers + cashiers + maxDaysBooking |
| PUT    | `/branch/:id` | `AuthGuard() + RolesGuard` | ADMIN    | Param: UUID, Body: `UpdateBranchDto`, File: image | updated branch                               |
| DELETE | `/branch/:id` | `AuthGuard() + RolesGuard` | ADMIN    | Param: UUID                                       | string message (stub)                        |

---

### Category — `/category`

| Method | Path            | Guard                      | Roles    | Request                                              | Response data    |
| ------ | --------------- | -------------------------- | -------- | ---------------------------------------------------- | ---------------- |
| GET    | `/category`     | `AuthGuard(false)`         | optional | Query: `type?`, Header: lang                         | categories list  |
| GET    | `/category/:id` | `AuthGuard(false)`         | optional | Param: UUID, Header: lang                            | single category  |
| POST   | `/category`     | `AuthGuard() + RolesGuard` | ADMIN    | Body: `CreateCategoryDto`, Header: lang              | created category |
| PUT    | `/category/:id` | `AuthGuard() + RolesGuard` | ADMIN    | Param: UUID, Body: `UpdateCategoryDto`, Header: lang | updated category |
| DELETE | `/category/:id` | `AuthGuard() + RolesGuard` | ADMIN    | Param: UUID                                          | deleted category |

---

### Service — `/service`

| Method | Path                  | Guard                      | Roles    | Request                                                          | Response data                 |
| ------ | --------------------- | -------------------------- | -------- | ---------------------------------------------------------------- | ----------------------------- |
| GET    | `/service`            | `AuthGuard(false)`         | optional | Header: lang                                                     | all services list             |
| GET    | `/service/:id`        | `AuthGuard(false)`         | optional | Param: UUID, Header: lang                                        | single service                |
| POST   | `/service`            | `AuthGuard() + RolesGuard` | ADMIN    | Body: `CreateServiceDto`, File: image, Header: lang              | created service               |
| PUT    | `/service/:id`        | `AuthGuard() + RolesGuard` | ADMIN    | Param: UUID, Body: `UpdateServiceDto`, File: image, Header: lang | updated service               |
| PUT    | `/service/:id/status` | `AuthGuard() + RolesGuard` | ADMIN    | Param: UUID, Body: `{ available: boolean }`                      | soft-deleted/restored service |

---

### Product — `/product` (**NO AUTH GUARDS — public**)

| Method | Path           | Request                               | Response data   |
| ------ | -------------- | ------------------------------------- | --------------- |
| POST   | `/product`     | Body: `CreateProductDto`, File: image | created product |
| GET    | `/product`     | —                                     | all products    |
| GET    | `/product/:id` | Param: id                             | single product  |
| PUT    | `/product/:id` | Param: id, Body: `UpdateProductDto`   | updated product |
| DELETE | `/product/:id` | Param: id                             | deleted product |

---

### Package — `/package` (all require `AuthGuard() + RolesGuard`)

| Method | Path                   | Roles | Request                               | Response data              |
| ------ | ---------------------- | ----- | ------------------------------------- | -------------------------- |
| POST   | `/package`             | any   | Body: `CreatePackageDto`, File: image | created package            |
| GET    | `/package`             | any   | Header: lang                          | packages list              |
| GET    | `/package/:id`         | any   | Param: id, Header: lang               | single package             |
| PUT    | `/package/:id`         | ADMIN | Param: id                             | **stub — no update logic** |
| DELETE | `/package/delete-many` | any   | Param: id (unused)                    | **stub**                   |

---

### Promo Code — `/promo-code` (all require `AuthGuard() + RolesGuard`)

| Method | Path                           | Request                    | Response data        |
| ------ | ------------------------------ | -------------------------- | -------------------- |
| POST   | `/promo-code`                  | Body: `CreatePromoCodeDto` | created promo code   |
| GET    | `/promo-code`                  | —                          | all promo codes      |
| POST   | `/promo-code/valid-promo-code` | Body: `{ code: string }`   | validated promo code |
| DELETE | `/promo-code/:id`              | Param: id                  | deleted promo code   |

---

### Client Packages — `/client-packages` (all require `AuthGuard()`)

| Method | Path                   | Request                                                     | Response data          |
| ------ | ---------------------- | ----------------------------------------------------------- | ---------------------- |
| POST   | `/client-packages`     | Body: `{ phone: string }`, Query: `packageId`, Header: lang | created client package |
| GET    | `/client-packages`     | Header: lang                                                | all client packages    |
| GET    | `/client-packages/:id` | Param: id, Header: lang                                     | single client package  |
| PATCH  | `/client-packages/:id` | Param: id                                                   | **stub**               |
| DELETE | `/client-packages/:id` | Param: id                                                   | removed client package |

---

### Complain — `/complain` (all require `AuthGuard() + RolesGuard`)

| Method | Path            | Roles       | Request                                      | Response data    |
| ------ | --------------- | ----------- | -------------------------------------------- | ---------------- |
| POST   | `/complain`     | USER, ADMIN | Body: `{ message: string }`, user from token | created complain |
| GET    | `/complain`     | ADMIN       | —                                            | all complains    |
| GET    | `/complain/:id` | ADMIN       | Param: id                                    | single complain  |
| PUT    | `/complain/:id` | ADMIN       | Param: id                                    | **stub**         |
| DELETE | `/complain/:id` | ADMIN       | Param: id                                    | removed complain |

---

### Notification — `/notification`

| Method | Path                              | Guard                   | Request                                                   | Response data        |
| ------ | --------------------------------- | ----------------------- | --------------------------------------------------------- | -------------------- |
| GET    | `/notification/reminder`          | Header: `x-cron-secret` | —                                                         | `{ success: true }`  |
| PUT    | `/notification/set-fcm`           | `AuthGuard()`           | Body: `{ fcmToken: string }`                              | updated user         |
| POST   | `/notification/send-notification` | `AuthGuard()`           | Body: `{ fcmTokens[], title, message, imageUrl?, data? }` | send result          |
| GET    | `/notification/get-history`       | `AuthGuard()`           | — (from token)                                            | notification history |

---

### Points — `/points` (all require `AuthGuard()`)

| Method | Path                        | Request                                         | Response data      |
| ------ | --------------------------- | ----------------------------------------------- | ------------------ |
| POST   | `/points`                   | Body: `CreatePointDto`, File: image             | created point tier |
| GET    | `/points`                   | Header: lang                                    | all point tiers    |
| POST   | `/points/purchase/:pointId` | Param: pointId, user from token                 | purchase result    |
| GET    | `/points/:id`               | Param: id, Header: lang                         | single point tier  |
| PATCH  | `/points/:id`               | Param: id, Body: `UpdatePointDto`, Header: lang | updated point tier |
| DELETE | `/points/:id`               | Param: id                                       | removed point tier |

---

### Static — `/static` (**NO AUTH GUARDS — public**)

| Method | Path                   | Request                                 | Response data            |
| ------ | ---------------------- | --------------------------------------- | ------------------------ |
| POST   | `/static/about`        | Body: `{ content, location, time }`     | created about            |
| POST   | `/static/questions`    | Body: `{ question, answer }`            | created question         |
| GET    | `/static`              | —                                       | `{ about, questions[] }` |
| PUT    | `/static/about`        | Body: `UpdateStaticDto`                 | updated about            |
| PUT    | `/static/question/:id` | Param: id, Body: `{ question, answer }` | updated question         |
| DELETE | `/static/question/:id` | Param: id                               | deleted question         |

---

## 3. Module Components & Responsibilities

### Service Facade Pattern (universal)

```
Controller → {Name}Service (facade, zero logic) → sub-services
```

### Auth — 7 sub-services

- **AuthSignupService**: full signup with role branching (USER/BARBER/CASHIER/ADMIN), slot creation, referral, token
- **AuthLoginService**: bcrypt compare, token generation, logout
- **AuthPasswordService**: change + reset (uses `DEFAULT_PASSWORD`)
- **AuthSlotService**: branch validation + `generateSlots` call
- **CreateUserService**: raw Prisma user+role create
- **ReferralCodeService**: referral validation + points award
- **TokenOperationsService**: JWT sign/verify/invalidate using `jsonwebtoken` + Prisma `Token` table

### User — 3 sub-services

- **UserQueryService**: `findAllUser` (paginated, by role), `findAllClients` (paginated, by phone), `findOneUser`, `currentUser`
- **UserMutationService**: `updateUser` (with optional avatar upload + vacation management), `updateBarberAvailability`, `unbanUser`, `deleteUser` (soft), `deleteEmployee`
- **UserRatingService**: `rateBarber` — validates order belongs to client, updates barber avg rating via weighted average

### Order — 6 sub-services

- **OrderBookingService**: `createOrder` (full booking: validates slot, applies promo/points/packages, creates records, sends notification) + `GetData` (dry-run pricing preview) — 600 lines
- **OrderListingService**: all list/filter queries (by user, date range, barber, cashier, billing) — 521 lines
- **OrderQueryService**: shared low-level Prisma selects
- **OrderMutationService**: `updateOrder`, `deleteOrderServices`, `cancelDeletedServices`, `updateOrderServices`, `generateSlot` — 341 lines
- **OrderPricingService**: `evaluateOrder` (discount + points calculation), `getSlots` (available slots after filtering booked ones), `getOrderById`, `getNonSelectedServices` — 323 lines
- **OrderLifecycleService**: `paidOrder` (marks paid, awards points, uses packages), `cancelOrder`, `startOrder`, `completeOrder` — 283 lines

### Admin — 2 sub-services

- **AdminQueryService**: `findAll` (settings), `getBarberOrdersWithCounts` (analytics per barber with date filter)
- **AdminMutationService**: `create`/`update` settings, `CheckPassword` (bcrypt compare)

### Branch — single service (no split)

No sub-service split; all logic in `branch.service.ts` (128 lines). Acceptable size.

### Category — single service (no split)

All logic inline at 193 lines. Could benefit from query/mutation split.

### Service — single service (no split, 114 lines)

---

## 4. Utilities & Infrastructure

### Guards (root `guard/`)

| Guard                      | Behavior                                                                                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthGuard(required=true)` | Factory returning mixin class. Validates JWT from `Authorization` header via Prisma `Token` table lookup + `jwt.verify`. Also accepts base64 API key via `x-api-key`. Sets `req.user` and `req.token`. `AuthGuard(false)` = optional auth (does not throw if missing). |
| `RolesGuard`               | Reads `@Roles()` metadata; throws `ForbiddenException` if user role not in list. Allows all if no roles set.                                                                                                                                                           |
| `OptionalAuthGuard`        | Always returns `true`. Sets user if valid JWT found. **Also updates FCM token** (side effect — should not be in a guard). Legacy, not used in new modules.                                                                                                             |

### Decorators (root `decorators/`)

| Decorator                    | Usage                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `@Roles(Role[])`             | Sets `roles` metadata for `RolesGuard`                                       |
| `@UserData('user'\|'token')` | Extracts `req.user` or `req.token`                                           |
| `@Lang()`                    | Reads `accept-language` header → `Language` enum (`EN`\|`AR`), defaults `EN` |

### Interceptors

| Interceptor                    | Behavior                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TransformResponseInterceptor` | Global. Wraps raw returns in `AppSuccess{data, message, statusCode}`. Passes through objects that already have a `message` key (used by auth to bypass wrapping and include `token`). |

### Filters

| Filter           | Behavior                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `NotFoundFilter` | Catches `NotFoundException`; returns 404 with branch name from `VERCEL_GIT_COMMIT_REF` env var |

### Utilities (`src/utils/`)

| File                  | Exports                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `AppSuccess.ts`       | `class AppSuccess<T> { data, message, statusCode }`                                                                                   |
| `constants.ts`        | `DEFAULT_PASSWORD = '123456'`                                                                                                         |
| `generate.ts`         | `Random(length=6)` — crypto-safe alphanumeric code                                                                                    |
| `generateSlot.ts`     | `generateSlots(prisma, start, end)` — reads `slotDuration` from DB settings; generates 12h AM/PM strings; handles midnight wraparound |
| `lib.ts`              | `hashedPassword`, `comparePassword` (bcrypt); `getOrderDateTime(order)` — parses slot string to JS `Date`                             |
| `not-found.filter.ts` | `NotFoundFilter` exception filter                                                                                                     |

### Common Library (`src/common/lib/`)

| File             | Exports                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `lib.ts`         | `getTranslationNames(translations, lang)` → `{nameEN, nameAR, name}`; `getDayRange(date)` → `{startOfDay, endOfDay}` |
| `swagger.ts`     | `ApiDoc(options)` — the **only correct** swagger decorator factory to use                                            |
| `swagger.lib.ts` | **Legacy** swagger helpers — `swagger.lib.ts`; do not use in new modules                                             |

### Translation Helpers (`src/class-type/translation.ts`)

| Export                     | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `createTranslation(dto)`   | Returns `{ createMany: { data: [...] } }` for Prisma nested create |
| `updateTranslation(dto)`   | Returns `{ updateMany: [...] }` for Prisma nested update           |
| `Translation(des?, lang?)` | Returns Prisma `include` shape for Translation relation            |
| `translationDes(lang?)`    | Like `Translation` but always includes `description`               |
| `translationDto`           | DTO class: `{ id?, name, language, description? }`                 |

### Config

| File                                | Purpose                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/config/multer.config.ts`       | `multerConfig(folder)` — returns multer options with Cloudinary storage; 5 MB limit; jpg/jpeg/png only; transforms to 500×500 |
| `src/config/cacheManager.module.ts` | Redis cache manager setup                                                                                                     |

---

## 5. Duplications

### Module Duplications (15 pairs)

Each module exists in both `src/{name}/` (legacy, inactive) and `src/modules/{name}/` (active).

| Module          | Legacy (inactive)      | Active                         |
| --------------- | ---------------------- | ------------------------------ |
| auth            | `src/auth/`            | `src/modules/auth/`            |
| user            | `src/user/`            | `src/modules/user/`            |
| order           | `src/order/`           | `src/modules/order/`           |
| branch          | `src/branch/`          | `src/modules/branch/`          |
| category        | `src/category/`        | `src/modules/category/`        |
| service         | `src/service/`         | `src/modules/service/`         |
| product         | `src/product/`         | `src/modules/product/`         |
| package         | `src/package/`         | `src/modules/package/`         |
| promo-code      | `src/promo-code/`      | `src/modules/promo-code/`      |
| client-packages | `src/client-packages/` | `src/modules/client-packages/` |
| complain        | `src/complain/`        | `src/modules/complain/`        |
| points          | `src/points/`          | `src/modules/points/`          |
| notification    | `src/notification/`    | `src/modules/notification/`    |
| admin           | `src/admin/`           | `src/modules/admin/`           |
| static          | `src/static/`          | `src/modules/static/`          |

### Cross-Cutting Duplications

| Item                                 | Locations                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `translationDto` class               | `src/class-type/translation.ts` AND `src/common/dto/translation.ts` (as `TranslationType`)                 |
| `getTranslationNames`                | `src/common/lib/lib.ts` AND `lib/lib.ts` (root-level legacy copy)                                          |
| `hashedPassword` / `comparePassword` | `src/utils/lib.ts` AND `bcrypt` calls inline in `auth-signup.service.ts` and `auth-login.service.ts`       |
| Swagger helpers                      | `src/common/lib/swagger.ts` (correct) AND `src/common/lib/swagger.lib.ts` (legacy)                         |
| `token.service.ts`                   | `src/token.service.ts` (root, legacy) AND `src/modules/auth/services/token-operations.service.ts` (active) |

### Cross-Module Import Issues

- `src/modules/order/order.module.ts` imports `PromoCodeService` from `../../promo-code/promo-code.service` (legacy path) instead of `src/modules/promo-code/`
- `src/modules/order/order.module.ts` imports `NotificationService` from `../../notification/notification.service` (legacy path)
- `src/modules/package/package.module.ts` imports `NotificationService` from legacy `src/notification/`
- `guard/auth.guard.ts` and `guard/optional-auth.guard.ts` import `AuthService` from `src/auth/auth.service` (legacy path)

---

## 6. Files Over 150 Lines

| Lines | File                                                    | Why it's large                                                                              |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 2565  | `src/order/order.service.ts`                            | **LEGACY MONOLITH** — entire order system in one file. Not active, but largest file in repo |
| 699   | `src/user/user.service.ts`                              | **LEGACY MONOLITH** — all user logic                                                        |
| 687   | `src/mock/mock.service.ts`                              | Mock/seed service — still imported in AppModule                                             |
| 600   | `src/modules/order/services/order-booking.service.ts`   | Complex booking logic: slot validation, pricing, package usage, promo codes, notifications  |
| 521   | `src/modules/order/services/order-listing.service.ts`   | Multiple listing queries with different filters and joins                                   |
| 436   | `src/auth/auth.service.ts`                              | **LEGACY** — monolithic auth                                                                |
| 341   | `src/modules/order/services/order-mutation.service.ts`  | Update + delete operations with complex business rules                                      |
| 323   | `src/modules/order/services/order-pricing.service.ts`   | Pricing calculations + slot availability logic                                              |
| 312   | `src/sms/sms.service.ts`                                | Active SMS service (not migrated)                                                           |
| 310   | `src/admin/admin.service.ts`                            | **LEGACY** admin service                                                                    |
| 283   | `src/modules/order/services/order-lifecycle.service.ts` | Order state machine transitions                                                             |
| 279   | `src/modules/order/order.controller.ts`                 | 18 endpoints in one controller                                                              |
| 273   | `src/modules/user/services/user-mutation.service.ts`    | Many user update paths                                                                      |
| 273   | `src/category/category.service.ts`                      | **LEGACY** category service                                                                 |
| 221   | `src/order/order.controller.ts`                         | **LEGACY** order controller                                                                 |
| 221   | `src/modules/user/services/user-query.service.ts`       | Multiple query shapes for different user types                                              |
| 209   | `src/modules/admin/services/admin-query.service.ts`     | Analytics query is complex                                                                  |
| 207   | `src/package/package.service.ts`                        | **LEGACY** package service                                                                  |
| 207   | `src/client-packages/client-packages.service.ts`        | **LEGACY** client packages                                                                  |
| 193   | `src/modules/category/category.service.ts`              | Query + mutation not split                                                                  |
| 180   | `src/paymob/paymob.service.ts`                          | Active Paymob integration (not migrated)                                                    |
| 170   | `src/points/points.service.ts`                          | **LEGACY** points                                                                           |
| 166   | `src/branch/branch.service.ts`                          | **LEGACY** branch                                                                           |
| 152   | `src/notification/notification.service.ts`              | **LEGACY** notification                                                                     |

---

## 7. Files With No Tests

**Total test files: 0**
**Total source files: ~240**
**Test coverage: 0%**

Every file in this repository is untested. Below are the highest-priority untested files:

### Critical (business-critical, complex logic)

| File                                                    | Why critical                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/modules/order/services/order-booking.service.ts`   | Core booking flow — slot conflict, pricing, promo, packages, notifications |
| `src/modules/order/services/order-pricing.service.ts`   | Discount + points calculations affect money                                |
| `src/modules/order/services/order-lifecycle.service.ts` | State machine — wrong transitions can corrupt data                         |
| `src/modules/auth/services/auth-signup.service.ts`      | Signup with role branching + referral handling                             |
| `src/modules/auth/services/token-operations.service.ts` | JWT generation + invalidation (security)                                   |
| `src/utils/generateSlot.ts`                             | Slot generation with midnight wraparound edge case                         |
| `src/utils/lib.ts`                                      | `getOrderDateTime` parses slot strings — regex logic needs coverage        |
| `src/modules/user/services/user-rating.service.ts`      | Barber rating calculation                                                  |

### High Priority (auth/access control)

| File                                                 | Reason                                          |
| ---------------------------------------------------- | ----------------------------------------------- |
| `guard/auth.guard.ts`                                | JWT + API key auth — security critical          |
| `guard/role.guard.ts`                                | RBAC — wrong behavior gives unauthorized access |
| `src/modules/auth/services/auth-password.service.ts` | Password reset/change                           |
| `src/modules/auth/services/referral-code.service.ts` | Points awarding logic                           |

### Medium Priority (data integrity)

| File                                                                       | Reason                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/modules/order/services/order-mutation.service.ts`                     | Admin-level order edits                                |
| `src/modules/user/services/user-mutation.service.ts`                       | Account deletion, unban                                |
| `src/modules/points/services/points-mutation.service.ts`                   | Point purchases                                        |
| `src/modules/client-packages/services/client-packages-mutation.service.ts` | Package purchases                                      |
| `src/modules/admin/services/admin-mutation.service.ts`                     | Settings write (affects slot duration, booking limits) |
| `src/common/interceptors/transform-response.interceptor.ts`                | Global response shape                                  |

### Lower Priority (simpler CRUD)

All other service files, controllers, DTOs, and swagger files are also untested.

---

## Appendix: Stub Methods (unimplemented)

| Method               | File                                           | Issue                                                                       |
| -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `remove()`           | `package.controller.ts` / `package.service.ts` | Route is `DELETE /package/delete-many` but `@Param('id')` is `_id` — unused |
| `update(id)`         | `package.controller.ts`                        | No body DTO passed; service stub has no logic                               |
| `update(+id)`        | `client-packages.controller.ts`                | Converts id to number (`+id`) but id is a string UUID                       |
| `remove(id: string)` | `branch.service.ts`                            | Returns string `"This action removes a #${id} branch"` — not implemented    |
| `updateComplain(id)` | `complain-mutation.service.ts`                 | Stub                                                                        |

---

## Appendix: Security Flags

| Issue                                                                        | Location                                    | Severity                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| Product endpoints have NO auth guards                                        | `src/modules/product/product.controller.ts` | HIGH — anyone can create/delete products                            |
| Static endpoints have NO auth guards                                         | `src/modules/static/static.controller.ts`   | HIGH — anyone can modify about/FAQ content                          |
| Firebase `initializeApp` called in controller constructor                    | `notification.controller.ts`                | MEDIUM — will throw on second instantiation; move to service/module |
| `OptionalAuthGuard` updates FCM token as side effect                         | `guard/optional-auth.guard.ts`              | LOW — unexpected mutation in a guard                                |
| `DEFAULT_PASSWORD = '123456'` hardcoded                                      | `src/utils/constants.ts`                    | MEDIUM — used in `resetPassword`                                    |
| `tokenOps.invalidateAllUserTokens` fetches ALL tokens and decodes in-process | `token-operations.service.ts:46`            | MEDIUM — O(n) on tokens table; no Prisma filter by userId           |

---

_Audit checkpoint saved. Resume here next session._
