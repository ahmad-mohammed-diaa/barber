# Phase 1: User Module + Auth Module — Optimization, Cleanup & Infrastructure

## Context
First phase of a multi-phase code quality initiative for the NestJS barber-shop API.
**Hard constraints**: No API response shape changes. No added or removed endpoints.

Goals this phase:
1. **Global `AppSuccess` interceptor** — removes boilerplate from every service
2. **Swagger** — install + document user & auth modules
3. **Services subfolder split** — break 700-line user.service.ts and 437-line auth.service.ts into focused sub-services (same pattern auth already started with its `services/` folder)
4. **Code quality fixes** — bugs, dead code, console.logs, import paths

---

## Step 0 — Project plans folder + Module folder setup

### 0a. Plans folder
Create `.claude/plans/` at the project root and save this file there as `phase-01-user-auth-module.md`.

### 0b. Create `src/modules/` and copy modules
All work happens inside `src/modules/`. The originals at `src/user/` and `src/auth/` are left **completely untouched** as backups.

Steps:
1. Create `src/modules/`
2. Copy `src/user/` → `src/modules/user/` (including `dto/` and any sub-folders)
3. Copy `src/auth/` → `src/modules/auth/` (including `dto/` and `services/`)
4. Update `src/app.module.ts` imports: `UserModule` from `./modules/user/user.module`, `AuthModule` from `./modules/auth/auth.module`
5. Fix internal import paths inside the copied files (relative paths may shift one level due to the move into `modules/`)

From this point on, every change described in this plan targets files under `src/modules/`, not `src/`.

---

## Step 1 — Global Infrastructure

### 1a. Install Swagger
```
npm install @nestjs/swagger swagger-ui-express
```

### 1b. Configure Swagger in main.ts
**File**: [src/main.ts](src/main.ts)

Add after `app.setGlobalPrefix('api')`:
```typescript
const config = new DocumentBuilder()
  .setTitle('Barber Shop API')
  .setDescription('Barber Shop Management System')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

### 1c. Create reusable Swagger helper lib
**New file**: [src/common/lib/swagger.lib.ts](src/common/lib/swagger.lib.ts)

Contains composable decorator factories shared across all modules:
```typescript
export const BearerAuth = () => applyDecorators(ApiBearerAuth());
export const ApiPaginationQuery = () => applyDecorators(
  ApiQuery({ name: 'page', required: false, type: Number }),
  ApiQuery({ name: 'pageSize', required: false, type: Number }),
);
export const ApiSuccessResponse = (description: string, statusCode = 200) =>
  applyDecorators(ApiResponse({ status: statusCode, description }));
export const ApiNotFoundResponse = (description = 'Resource not found') =>
  applyDecorators(ApiResponse({ status: 404, description }));
export const ApiUnauthorizedResponse = () =>
  applyDecorators(ApiResponse({ status: 401, description: 'Unauthorized' }));
```

### 1c. Create `@ResponseMessage` decorator (optional)
**New file**: [src/common/decorators/response-message.decorator.ts](src/common/decorators/response-message.decorator.ts)

```typescript
import { SetMetadata } from '@nestjs/common';
export const ResponseMessage = (message: string) =>
  SetMetadata('response_message', message);
```

### 1d. Create `TransformResponseInterceptor`
**New file**: [src/common/interceptors/transform-response.interceptor.ts](src/common/interceptors/transform-response.interceptor.ts)

**Detection rule** (simple, no opt-out decorators needed):
- If response already has a `message` property → return it **as-is** (handles: AppSuccess instances, auth login/signup with `token`, any already-shaped response)
- Otherwise → the service returned raw data; wrap it using `@ResponseMessage` message if present, otherwise default to `'Success'`

```typescript
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, any> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const message = this.reflector.get<string>('response_message', context.getHandler());

    return next.handle().pipe(
      map((data) => {
        // Already shaped (AppSuccess, auth responses with token, etc.) — pass through
        if (data && typeof data === 'object' && 'message' in data) return data;
        // Raw data — wrap
        return new AppSuccess(data, message ?? 'Success', 200);
      }),
    );
  }
}
```

No `@SkipTransform` needed. Auth login/signup responses include `message` in their plain object so they pass through automatically.

### 1f. Register interceptor globally
**File**: [src/app.module.ts](src/app.module.ts)

Add to providers:
```typescript
{ provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor }
```

---

## Step 2 — Auth Module Cleanup

### 2a. Split auth.service.ts — extract token operations
**New file**: `src/modules/auth/services/token-operations.service.ts`

Move from `auth.service.ts`:
- `loginToken(token)` — stores token in DB (remove `console.log(expiredAt)`)
- `invalidateToken(token)` — deletes token from DB
- `invalidateAllUserTokens(userId)` — decodes all tokens and deletes by userId
- `generateToken(userId)` — signs JWT and calls loginToken
- `verifyToken(token)` — verifies JWT signature

`AuthService` injects `TokenOperationsService` and delegates these calls.

### 2b. Move `generateSlots` to AuthSlotService
**File**: `src/modules/auth/services/auth-slot.service.ts`

Move `generateSlots(start, end)` from `auth.service.ts` into `AuthSlotService`. Update `UserMutationService` to inject `AuthSlotService` directly instead of the full `AuthService`.

### 2c. Remove dead commented code
**File**: `src/modules/auth/auth.service.ts`

Delete the commented-out `createUser` block (lines ~250–300, ~50 lines). Remove `console.log(expiredAt)` (in `loginToken` before move).

### 2d. Remove AppSuccess from auth service — use @ResponseMessage
**File**: `src/modules/auth/auth.service.ts` + `src/modules/auth/auth.controller.ts`

Methods that use `new AppSuccess(...)` and can be converted:
- `logout` → service returns `null`, route gets `@ResponseMessage('logout successfully')`
- `changePassword` → service returns `null`, route gets `@ResponseMessage('Password changed successfully')`
- `resetPassword` → service returns `user`, route gets `@ResponseMessage('Password reset successfully')`

**`login` and `signup` require no changes** — their responses already include a `message` field (`{ data, token, message, statusCode }`), so the interceptor passes them through automatically.

Fix `checkReferralCode` in auth controller: currently calls `authService.checkReferralCode()` which is `async` but result is used synchronously. It also constructs `AppSuccess` directly in the controller — move the check and response to the service, add `@ResponseMessage`.

### 2e. Create auth swagger file + add Swagger to auth
**New file**: [src/modules/auth/auth.swagger.ts](src/modules/auth/auth.swagger.ts)

Contains composed decorators using `swagger.lib.ts` helpers:
```typescript
export const SignupDoc = () => applyDecorators(
  ApiOperation({ summary: 'Register a new user' }),
  ApiSuccessResponse('User registered', 201),
);
export const LoginDoc = () => applyDecorators(
  ApiOperation({ summary: 'Login' }),
  ApiSuccessResponse('Login successful', 200),
);
// ... one per route
```

**File**: [src/modules/auth/auth.controller.ts](src/modules/auth/auth.controller.ts)

Add `@ApiTags('Auth')` on the controller class. Apply the composed decorator from `auth.swagger.ts` on each route (e.g. `@SignupDoc()`).

Add `@ApiProperty()` to [src/modules/auth/dto/auth-register-dto.ts](src/modules/auth/dto/auth-register-dto.ts) and [src/modules/auth/dto/auth-login-dto.ts](src/modules/auth/dto/auth-login-dto.ts).

### 2f. Update AuthModule providers
**File**: `src/modules/auth/auth.module.ts`

Add `TokenOperationsService` to `providers` and `exports` (exported so UserModule can call `generateToken` if needed).

---

## Step 3 — User Module: Code Quality Fixes

**File**: `src/modules/user/user.controller.ts`

### 3a. Fix route ordering (bug — current/profile unreachable)
`@Get(':id')` appears before `@Get('current/profile')` — NestJS matches `:id` first and treats "current" as a user id.

**Fix**: Move `@Get('current/profile')` above `@Get(':id')`.

### 3b. Fix deleteUser broken param (silent bug)
`@Delete('deleteAccount')` uses `@Param('id') id: string` but route has no `:id` segment — `id` is always `undefined`.

**Fix**: Remove `@Param('id')`. Pass `user.id` from `@UserData('user')` to `deleteUser`.

### 3c. Add ParseUUIDPipe to `GET /:id`
`@Get(':id')` is missing UUID validation unlike all other `:id` routes.

**Fix**: Add `@Param('id', ParseUUIDPipe) id: string`.

### 3d. Remove unused `user` param in `deleteEmployee`
`deleteEmployee` injects `@UserData('user') user: User` but never uses it.

**Fix**: Remove that parameter.

### 3e. Fix import path for multerConfig
`import { multerConfig } from 'src/config/multer.config'` uses absolute path.

**Fix**: Change to `../../config/multer.config`.

**File**: `src/modules/user/user.service.ts`

### 3f. Fix null-before-destructure in `findOne` (bug)
Lines 429–435: `user` is destructured before the null check. If no user is found, this throws a `TypeError` (500 error) instead of a 404 `NotFoundException`.

**Fix**: Move `if (!user) throw new NotFoundException(...)` to immediately after the Prisma query, before destructuring.

### 3g. Remove console.log statements
- Line 327: `console.log(updateUser)` in `updateUser`
- Line 441: `console.log('Processing slot info:', Slot)` in `findOne`

### 3h. Remove unnecessary try/catch wrappers
`findAllClients` and `findAllUser` wrap their queries in try/catch, `console.error`, then immediately re-throw. Remove both wrappers.

### 3i. Use OrderStatus enum in `rateBarber`
Line 643 uses string literals `'COMPLETED'` and `'PAID'` instead of `OrderStatus.COMPLETED` / `OrderStatus.PAID`.

### 3j. Remove unused `hasOrdersBetweenDates` method
Never called anywhere. Delete it.

### 3k. Fix import paths
- `'src/utils/AppSuccess'` → `'../utils/AppSuccess'`
- `'src/auth/auth.service'` → `'../auth/auth.service'`

---

## Step 4 — User Module: Services Subfolder Split

Create `src/user/services/` with three focused services. `user.service.ts` becomes a thin facade (same pattern as auth module).

### 4a. `UserQueryService`
**New file**: `src/modules/user/services/user-query.service.ts`

Injected: `PrismaService`

Methods:
- `private processSlotInfo(employeeData)` — extracted from the 3 duplicate inline definitions
- `findOne(id)` — made **public** (needed by mutation service); includes the fixed null-check order from Step 3f
- `findAllUser(page, pageSize, role?)`
- `findAllClients(page, pageSize, phone?)`
- `findOneUser(id)` — calls `this.findOne(id)` internally
- `CurrentUser(user)` — calls `this.findOne(user.id)` or the same Prisma query

### 4b. `UserMutationService`
**New file**: `src/modules/user/services/user-mutation.service.ts`

Injected: `PrismaService`, `AuthSlotService` (for `generateSlots`), `UserQueryService` (for `findOne`)

Methods:
- `updateUser(id, userData, file?)`
- `updateBarberAvailability(id)`
- `unbanUser(phone)`
- `deleteUser(userId)`
- `deleteEmployee(id)`

### 4c. `UserRatingService`
**New file**: `src/modules/user/services/user-rating.service.ts`

Injected: `PrismaService`

Methods:
- `rateBarber(clientId, barberId, orderId, rate)` — updated with OrderStatus enum (Step 3i)
- `getLatestOrderDate(barberId)` — private helper called only from rateBarber... actually called from UserMutationService.updateUser → move to mutation or keep here as injectable

  > `getLatestOrderDate` is called only from `updateUser`, so it fits better in `UserMutationService` as a private method. Rating service is self-contained.

### 4d. Update `user.service.ts` as thin facade
**File**: `src/modules/user/user.service.ts`

Inject the three sub-services. Each public method is a one-liner delegation:
```typescript
findAllUser(page, pageSize, role?) {
  return this.userQuery.findAllUser(page, pageSize, role);
}
```

The Prisma `select` constants (`this.user`, `this.barber`, etc.) move to the service that uses them.

### 4e. Update UserModule
**File**: `src/modules/user/user.module.ts`

Add `UserQueryService`, `UserMutationService`, `UserRatingService` to `providers`.

---

## Step 5 — User Module: Remove AppSuccess + Add Swagger

### 5a. Remove `new AppSuccess(...)` from user sub-services
Each sub-service method returns **raw data** instead of `new AppSuccess(data, message, statusCode)`.

Example:
```typescript
// before
return new AppSuccess({ users }, 'Users fetched successfully', 200);
// after
return { users };
```

### 5b. Add `@ResponseMessage` to user controller routes (optional)
**File**: `src/modules/user/user.controller.ts`

`@ResponseMessage` is **optional** — without it the interceptor uses `'Success'` as the default. Add it to routes where a descriptive message matters:

| Route | Decorator |
|-------|-----------|
| `GET /` | `@ResponseMessage('Users fetched successfully')` |
| `GET /clients` | `@ResponseMessage('Clients fetched successfully')` |
| `GET /:id` | `@ResponseMessage('User fetched successfully')` |
| `GET /current/profile` | `@ResponseMessage('User fetched successfully')` |
| `PUT /:id` | `@ResponseMessage('User updated successfully')` |
| `POST /rate-barber` | `@ResponseMessage('Barber rated successfully')` |
| All others | no decorator — defaults to `'Success'` |

### 5c. Create user swagger file + add Swagger to user module
**New file**: [src/modules/user/user.swagger.ts](src/modules/user/user.swagger.ts)

Contains composed decorators for every user route, built with helpers from `swagger.lib.ts`:
```typescript
export const FindAllUsersDoc = () => applyDecorators(
  ApiOperation({ summary: 'Get all users (paginated, optional role filter)' }),
  ApiPaginationQuery(),
  ApiQuery({ name: 'role', required: false, enum: Role }),
  BearerAuth(),
  ApiSuccessResponse('Users fetched successfully'),
  ApiUnauthorizedResponse(),
);
// ... one per route
```

**File**: [src/modules/user/user.controller.ts](src/modules/user/user.controller.ts)

Add `@ApiTags('User')` on the controller class. Apply composed decorator from `user.swagger.ts` on each route (e.g. `@FindAllUsersDoc()`).

**Files**: [src/modules/user/dto/user-update-dto.ts](src/modules/user/dto/user-update-dto.ts) + [src/modules/user/dto/rate-barber.dto.ts](src/modules/user/dto/rate-barber.dto.ts)

Add `@ApiProperty()` / `@ApiPropertyOptional()` to all DTO fields.

---

## Files to create

| New File | Purpose |
|----------|---------|
| `src/modules/` | New home for all modules we work on (backups stay in `src/`) |
| `src/modules/user/` | Copied from `src/user/` — all user edits happen here |
| `src/modules/auth/` | Copied from `src/auth/` — all auth edits happen here |
| [src/common/lib/swagger.lib.ts](src/common/lib/swagger.lib.ts) | Reusable Swagger decorator factories |
| [src/common/decorators/response-message.decorator.ts](src/common/decorators/response-message.decorator.ts) | `@ResponseMessage('...')` — optional, overrides default `'Success'` |
| [src/common/interceptors/transform-response.interceptor.ts](src/common/interceptors/transform-response.interceptor.ts) | Global response wrapping |
| [src/modules/auth/auth.swagger.ts](src/modules/auth/auth.swagger.ts) | Composed Swagger decorators for auth routes |
| [src/modules/auth/services/token-operations.service.ts](src/modules/auth/services/token-operations.service.ts) | Auth token DB operations (split from auth.service) |
| [src/modules/user/user.swagger.ts](src/modules/user/user.swagger.ts) | Composed Swagger decorators for user routes |
| [src/modules/user/services/user-query.service.ts](src/modules/user/services/user-query.service.ts) | All read operations |
| [src/modules/user/services/user-mutation.service.ts](src/modules/user/services/user-mutation.service.ts) | All write operations |
| [src/modules/user/services/user-rating.service.ts](src/modules/user/services/user-rating.service.ts) | Barber rating logic |

## Files to modify

| File | Changes |
|------|---------|
| [src/main.ts](src/main.ts) | Add Swagger setup |
| [src/app.module.ts](src/app.module.ts) | Point UserModule/AuthModule imports to `./modules/`, register interceptor |
| `src/modules/auth/auth.service.ts` | Remove dead code, delegate to sub-services, remove AppSuccess |
| `src/modules/auth/auth.controller.ts` | Add `@ApiTags`, apply swagger decorators, @ResponseMessage, fix checkReferralCode |
| `src/modules/auth/auth.module.ts` | Add TokenOperationsService |
| `src/modules/auth/services/auth-slot.service.ts` | Add generateSlots moved from auth.service |
| `src/modules/auth/dto/auth-register-dto.ts` | Add @ApiProperty |
| `src/modules/auth/dto/auth-login-dto.ts` | Add @ApiProperty |
| `src/modules/user/user.module.ts` | Add sub-service providers |
| `src/modules/user/user.service.ts` | Thin facade, delegates to sub-services, remove AppSuccess |
| `src/modules/user/user.controller.ts` | Route order, param fixes, @ResponseMessage, apply swagger decorators |
| `src/modules/user/dto/user-update-dto.ts` | Add @ApiProperty |
| `src/modules/user/dto/rate-barber.dto.ts` | Add @ApiProperty |

**Untouched (backups)**: `src/user/`, `src/auth/` — never modified.

---

## Verification

1. `npm install` — verify @nestjs/swagger installs correctly
2. `npm run build` — must pass with zero TypeScript errors
3. `npm run lint` — must pass
4. `GET /api/docs` — Swagger UI loads, shows user + auth endpoints with full documentation
5. Manual API response checks — every endpoint returns identical shape to before:
   - `GET /api/user` → `{ data: { users: [...] }, message: '...', statusCode: 200 }`
   - `GET /api/user/current/profile` → now reachable (was broken by route ordering)
   - `DELETE /api/user/deleteAccount` → now uses correct user id (was broken)
   - `POST /api/auth/login` → `{ data: user, token: '...', message: '...', statusCode: 201 }` (unchanged, no interceptor wrapping)
   - All other endpoints return same shape as before
