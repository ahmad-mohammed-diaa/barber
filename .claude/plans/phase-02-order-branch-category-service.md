# Phase 2: Branch + Category + Service + Order Modules — Optimization & Cleanup

## Context
Second phase of the multi-phase code quality initiative for the NestJS barber-shop API.
**Hard constraints**: No API response shape changes. No added or removed endpoints.

Modules in scope:
- **Order** — 2,565-line service (needs services/ split), 13 console.logs, 22+ AppSuccess uses, inline types
- **Branch** — 166-line service, AppSuccess cleanup, broken import paths
- **Category** — 273-line service, AppSuccess cleanup, null-before-destructure bug
- **Service** — 144-line service, AppSuccess cleanup, broken import paths

Same conventions as Phase 1:
- Originals in `src/branch/`, `src/category/`, `src/service/`, `src/order/` stay **untouched** as backups
- All edits happen inside `src/modules/`
- Return raw data from services; interceptor wraps in `AppSuccess` automatically
- `@ResponseMessage('...')` only when a custom message is needed (otherwise defaults to `'Success'`)
- `PartialType` always from `@nestjs/swagger`, never `@nestjs/mapped-types`

---

## Step 0 — Copy Modules

Copy all four modules into `src/modules/`:
1. `src/branch/` → `src/modules/branch/`
2. `src/category/` → `src/modules/category/`
3. `src/service/` → `src/modules/service/`
4. `src/order/` → `src/modules/order/`

Update `src/app.module.ts` — switch four import paths to the `./modules/` copies:
```typescript
import { BranchModule } from './modules/branch/branch.module';
import { CategoryModule } from './modules/category/category.module';
import { ServiceModule } from './modules/service/service.module';
import { OrderModule } from './modules/order/order.module';
```

---

## Step 1 — Branch Module

### 1a. Fix import paths in branch.service.ts
| Old | New |
|-----|-----|
| `'src/prisma/prisma.service'` | `'../../prisma/prisma.service'` |
| `'src/utils/AppSuccess'` | remove import entirely |
| `'../../src/class-type/translation'` | `'../../class-type/translation'` |

### 1b. Fix import path in branch.controller.ts
`'../../src/config/multer.config'` → `'../../config/multer.config'`

### 1c. Remove AppSuccess from branch.service.ts
Each method returns raw data. Remove `Promise<AppSuccess<...>>` return type annotations.

| Method | After |
|--------|-------|
| `create` | `return branch` |
| `findAll` | `return { branches }` |
| `findOne` | `return branch` |
| `update` | `return updatedBranch` |

### 1d. Add @ResponseMessage to branch.controller.ts routes
```typescript
@ResponseMessage('Branch created successfully')  // POST /
@ResponseMessage('Branches found successfully')  // GET /
@ResponseMessage('Branch found successfully')    // GET :id
@ResponseMessage('Branch updated successfully')  // PUT :id
```

### 1e. Create branch Swagger decorators
**New file**: `src/modules/branch/branch.swagger.ts`
One composed decorator per route (`CreateBranchDoc`, `FindAllBranchesDoc`, `FindOneBranchDoc`, `UpdateBranchDoc`, `DeleteBranchDoc`) using helpers from `src/common/lib/swagger.lib.ts`.

### 1f. Add @ApiProperty to branch DTOs
- `create-branch.dto.ts` — add `@ApiProperty` / `@ApiPropertyOptional` with examples.
- `update-branch.dto.ts` — switch `PartialType` from `@nestjs/mapped-types` → `@nestjs/swagger`.

### 1g. Create dto/index.ts barrel
```typescript
export * from './create-branch.dto';
export * from './update-branch.dto';
```

### 1h. Register DTOs in main.ts extraModels
```typescript
import * as BranchDto from './modules/branch/dto';
// add ...Object.values(BranchDto) to extraModels array
```

### 1i. Add @ApiTags + swagger decorators to branch.controller.ts
```typescript
@ApiTags('Branch')
@Controller('branch')
```

---

## Step 2 — Category Module

### 2a. Fix import paths in category.service.ts
| Old | New |
|-----|-----|
| `'src/utils/AppSuccess'` | remove import entirely |
| `'../../src/class-type/translation'` | `'../../class-type/translation'` |

### 2b. Fix null-before-destructure bug in findOneOrFail (category.service.ts lines 238–271)
The current code destructures `fetchedCategory` **before** the null check — if category not found, Prisma returns `null` and destructuring throws `TypeError` (500) instead of `NotFoundException` (404).

**Fix**: Move null check immediately after the Prisma query, before destructuring:
```typescript
const fetchedCategory = await this.prisma.category.findUnique({ ... });
if (!fetchedCategory) throw new NotFoundException('Category not found'); // ← move here
const { Translation: categoryTranslation, services, ...rest } = fetchedCategory;
// ... rest of transformation
// Remove the stale: if (!category) throw new NotFoundException(...) at line ~269
```

### 2c. Remove AppSuccess from category.service.ts
| Method | After |
|--------|-------|
| `findAllCategories` | `return { categories, ...(packages?.length && { package: packages }) }` |
| `findCategoryById` | `return category` |
| `createCategory` | `return category` |
| `updateCategory` | `return category` |
| `delete` | `return deleteCategory` |

### 2d. Fix category.controller.ts
Remove `import { AppSuccess } from 'src/utils/AppSuccess'` and all `AppSuccess<...>` return type annotations.

Fix absolute import in `create-category.dto.ts`: `'src/class-type/translation'` → `'../../class-type/translation'`.

### 2e. Add @ResponseMessage to category.controller.ts routes
```typescript
@ResponseMessage('Categories found successfully')  // GET /
@ResponseMessage('Category found successfully')    // GET :id
@ResponseMessage('Category created successfully')  // POST /
@ResponseMessage('Category updated successfully')  // PUT :id
@ResponseMessage('Category deleted successfully')  // DELETE :id
```

### 2f. Create category Swagger decorators
**New file**: `src/modules/category/category.swagger.ts`

### 2g. Add @ApiProperty to category DTOs
- `create-category.dto.ts` — add `@ApiProperty` / `@ApiPropertyOptional` with examples.
- `update-category.dto.ts` — switch `PartialType` from `@nestjs/mapped-types` → `@nestjs/swagger`.

### 2h. Create dto/index.ts barrel + register in main.ts
```typescript
export * from './create-category.dto';
export * from './update-category.dto';
```
```typescript
import * as CategoryDto from './modules/category/dto';
// add ...Object.values(CategoryDto) to extraModels
```

### 2i. Add @ApiTags + swagger decorators to category.controller.ts

---

## Step 3 — Service Module

### 3a. Fix import paths in service.service.ts
| Old | New |
|-----|-----|
| `'src/utils/AppSuccess'` | remove entirely |
| `'../../src/class-type/translation'` | `'../../class-type/translation'` |

### 3b. Fix import path in service.controller.ts
`'../../src/config/multer.config'` → `'../../config/multer.config'`

### 3c. Create ServiceStatusDto
**New file**: `src/modules/service/dto/service-status.dto.ts`
```typescript
export class ServiceStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  available: boolean;
}
```
Replace inline `available: { available: boolean }` type in `softDeleteService` and controller with `ServiceStatusDto`.

### 3d. Remove AppSuccess from service.service.ts
| Method | After |
|--------|-------|
| `getAllService` | `return { services }` |
| `getServiceById` | `return service` |
| `createService` | `return service` |
| `updateService` | `return service` |
| `softDeleteService` | `return service` |

### 3e. Add @ResponseMessage to service.controller.ts routes
```typescript
@ResponseMessage('Services found successfully')  // GET /
@ResponseMessage('Service found successfully')   // GET :id
@ResponseMessage('Service created successfully') // POST /
@ResponseMessage('Service updated successfully') // PUT :id
@ResponseMessage('Service deleted successfully') // PUT :id/status
```

### 3f. Create service Swagger decorators
**New file**: `src/modules/service/service.swagger.ts`

### 3g. Add @ApiProperty to service DTOs
- `create-service.dto.ts` — add `@ApiProperty` with examples.
- `update-service.dto.ts` — switch `PartialType` from `@nestjs/mapped-types` → `@nestjs/swagger`.

### 3h. Create dto/index.ts barrel + register in main.ts
```typescript
export * from './create-service.dto';
export * from './update-service.dto';
export * from './service-status.dto';
```
```typescript
import * as ServiceDto from './modules/service/dto';
// add ...Object.values(ServiceDto) to extraModels
```

### 3i. Add @ApiTags + swagger decorators to service.controller.ts

---

## Step 4 — Order Module: Code Quality Fixes

### 4a. Create missing DTOs (replace all inline types)
All new files in `src/modules/order/dto/`:

**`paid-order-body.dto.ts`** — `{ discount?: number; points?: number }`

**`generate-slot-body.dto.ts`** — `{ start: number; end: number }`

**`get-slots-query.dto.ts`** — `{ date: string; barberId?: string; totalDuration?: number }`

**`barber-orders-query.dto.ts`** — `{ fromDate?: string; toDate?: string }` (for `GET /barber-orders`)

**`date-range-query.dto.ts`** — `{ fromDate?: string; toDate?: string }` (for `GET /getAllOrders` and `GET /cashier`)

Each field gets `@ApiProperty` / `@ApiPropertyOptional` with examples.

### 4b. Fix existing order DTOs
**`create-order.dto.ts`** — add `@ApiProperty` / `@ApiPropertyOptional` with examples to all 12 fields.

**`update-order.dto.ts`** — switch `PartialType` from `@nestjs/mapped-types` → `@nestjs/swagger`. Fix import `'src/order/dto/create-order.dto'` → `'./create-order.dto'`. Add `@ApiPropertyOptional` to the 4 added fields.

**`update-order-services.dto.ts`** — add `@ApiProperty` with example.

### 4c. Fix order.controller.ts
Remove `console.log(fromDate, toDate)` (line 46).

Replace inline body/query types with new DTOs:
| Route | Change |
|-------|--------|
| `getBarberOrders` | `@Query() { fromDate, toDate }` → `@Query() query: BarberOrdersQueryDto` |
| `paidOrder` | `@Body() body?` inline type → `@Body() body?: PaidOrderBodyDto` |
| `generateSlot` | `@Body() body` inline type → `@Body() body: GenerateSlotBodyDto` |
| `getSlots` | `@Query() query` inline type → `@Query() query: GetSlotsQueryDto` |

### 4d. Remove inline interface from order.service.ts
Delete `interface PrismaServiceType extends Service { isFree: boolean; }` (lines 33–35). Replace usage with `Service & { isFree: boolean }` inline.

### 4e. Fix import paths in order.service.ts
| Old | New |
|-----|-----|
| `'src/prisma/prisma.service'` | `'../../prisma/prisma.service'` |
| `'src/utils/AppSuccess'` | remove entirely |
| `'src/promo-code/promo-code.service'` | `'../promo-code/promo-code.service'` |
| `'src/notification/notification.service'` | `'../notification/notification.service'` |
| `'src/class-type/translation'` | `'../../class-type/translation'` |
| `'../utils/lib'` | `'../../utils/lib'` |

### 4f. Remove all 13 console.log statements from order.service.ts
Lines: 311, 998, 1078, 1357, 1358, 1729, 2165, 2198, 2255, 2256, 2267, 2285, 2419, 2464.

---

## Step 5 — Order Module: Services Subfolder Split

### 5a. OrderQueryService
**New file**: `src/modules/order/services/order-query.service.ts`

Injected: `PrismaService`, `PromoCodeService`

Methods moved from order.service.ts:
- `findOneOrFail(id)` — **public** (called by mutation service)
- `getAllOrdersDateRange(user, language, fromDate, toDate)`
- `getNonSelectedServices(id, language)`
- `billOrders(date)`
- `getCashierOrders(id, lang, from, to)`
- `getAllOrders(userId, lang)`
- `getPayedOrders(lang, from, to)`
- `GetBarberOrders(userId, lang, fromDate?, toDate?)`
- `getOrderById(id)`
- `GetData(orderDto, userId, lang)` — uses PromoCodeService for price preview
- `evaluateOrder(id, opts)`
- `getSlots(date, barberId?, totalDuration?)`

### 5b. OrderMutationService
**New file**: `src/modules/order/services/order-mutation.service.ts`

Injected: `PrismaService`, `NotificationService`, `OrderQueryService`

Methods moved from order.service.ts:
- `createOrder(dto, userId, lang)`
- `updateOrder(id, dto, role)`
- `updateOrderServices(id, dto)`
- `deleteOrderServices(id, password)`
- `cancelDeletedServices(id, password)`
- `cancelOrder(id, role)`
- `startOrder(id)`
- `completeOrder(id)`
- `paidOrder(id, body?)`
- `generateSlot(start, end)`

### 5c. Update order.service.ts as thin facade
Inject `OrderQueryService` and `OrderMutationService`. Each public method delegates in one line:
```typescript
getAllOrders(userId: string, lang: Language) {
  return this.orderQuery.getAllOrders(userId, lang);
}
createOrder(dto: CreateOrderDto, userId: string, lang: Language) {
  return this.orderMutation.createOrder(dto, userId, lang);
}
```

### 5d. Remove AppSuccess from both sub-services
Every `return new AppSuccess(data, message)` → `return data` or `return { field: data }` matching the original object shape.

### 5e. Update OrderModule providers
**File**: `src/modules/order/order.module.ts`
```typescript
providers: [OrderService, OrderQueryService, OrderMutationService, PromoCodeService, NotificationService],
```

---

## Step 6 — Order Module: Swagger

### 6a. Add @ResponseMessage to order.controller.ts routes
| Route | Message |
|-------|---------|
| `GET /` | `'Orders fetched successfully'` |
| `GET /getAllOrders` | `'Orders fetched successfully'` |
| `GET /barber-orders` | `'Orders fetched successfully'` |
| `GET categories/:id` | `'Services found successfully'` |
| `GET /cashier` | `'Orders fetched successfully'` |
| `GET /paid-orders` | `'Orders fetched successfully'` |
| `GET /evaluate-order/:id` | `'Order evaluated successfully'` |
| `GET /slots` | `'Slots fetched successfully'` |
| `GET :id` | `'Order fetched successfully'` |
| `POST /` | `'Order created successfully'` |
| `POST /OrderDetails` | `'Order details fetched successfully'` |
| `POST /generate-slot` | `'Slots generated successfully'` |
| `PUT /:id` | `'Order updated successfully'` |
| `PUT /paid-order/:id` | `'Order marked as paid'` |
| `PUT /cancel-order/:id` | `'Order cancelled successfully'` |
| `PUT /start-order/:id` | `'Order started successfully'` |
| `PUT /complete-order/:id` | `'Order completed successfully'` |
| `PUT /update-order-services/:id` | `'Order services updated successfully'` |
| `PUT /delete-order-services/:id` | `'Order services deleted successfully'` |
| `PUT /cancel-deleted-services/:id` | `'Deleted services cancelled successfully'` |

### 6b. Create order Swagger decorators
**New file**: `src/modules/order/order.swagger.ts`
One composed decorator per route (20 routes) using `swagger.lib.ts` helpers.

### 6c. Create dto/index.ts barrel + register in main.ts
```typescript
export * from './create-order.dto';
export * from './update-order.dto';
export * from './update-order-services.dto';
export * from './paid-order-body.dto';
export * from './generate-slot-body.dto';
export * from './get-slots-query.dto';
export * from './barber-orders-query.dto';
export * from './date-range-query.dto';
```
```typescript
import * as OrderDto from './modules/order/dto';
// add ...Object.values(OrderDto) to extraModels
```

### 6d. Add @ApiTags + swagger decorators to order.controller.ts
```typescript
@ApiTags('Order')
@Controller('order')
```

---

## Files to Create

| New File | Purpose |
|----------|---------|
| `src/modules/branch/` | Copy of `src/branch/` |
| `src/modules/category/` | Copy of `src/category/` |
| `src/modules/service/` | Copy of `src/service/` |
| `src/modules/order/` | Copy of `src/order/` |
| `src/modules/branch/branch.swagger.ts` | Swagger decorators for branch (5 routes) |
| `src/modules/category/category.swagger.ts` | Swagger decorators for category (5 routes) |
| `src/modules/service/service.swagger.ts` | Swagger decorators for service (5 routes) |
| `src/modules/service/dto/service-status.dto.ts` | `{ available: boolean }` DTO |
| `src/modules/order/order.swagger.ts` | Swagger decorators for order (20 routes) |
| `src/modules/order/services/order-query.service.ts` | All read operations + findOneOrFail |
| `src/modules/order/services/order-mutation.service.ts` | All write operations |
| `src/modules/order/dto/paid-order-body.dto.ts` | Inline body type replacement |
| `src/modules/order/dto/generate-slot-body.dto.ts` | Inline body type replacement |
| `src/modules/order/dto/get-slots-query.dto.ts` | Inline query type replacement |
| `src/modules/order/dto/barber-orders-query.dto.ts` | Inline query type replacement |
| `src/modules/order/dto/date-range-query.dto.ts` | Inline query type replacement |
| `src/modules/branch/dto/index.ts` | Barrel export |
| `src/modules/category/dto/index.ts` | Barrel export |
| `src/modules/service/dto/index.ts` | Barrel export |
| `src/modules/order/dto/index.ts` | Barrel export |

## Files to Modify

| File | Changes |
|------|---------|
| `src/app.module.ts` | Switch branch/category/service/order imports to `./modules/` |
| `src/main.ts` | Add BranchDto, CategoryDto, ServiceDto, OrderDto to `extraModels` |
| `src/modules/branch/branch.service.ts` | Fix imports, remove AppSuccess |
| `src/modules/branch/branch.controller.ts` | Fix import, add @ApiTags, @ResponseMessage, swagger decorators |
| `src/modules/branch/dto/create-branch.dto.ts` | Add @ApiProperty |
| `src/modules/branch/dto/update-branch.dto.ts` | Switch PartialType to @nestjs/swagger |
| `src/modules/category/category.service.ts` | Fix imports, fix null-before-destructure bug, remove AppSuccess |
| `src/modules/category/category.controller.ts` | Remove AppSuccess types, add @ApiTags, @ResponseMessage, swagger decorators |
| `src/modules/category/dto/create-category.dto.ts` | Fix absolute import, add @ApiProperty |
| `src/modules/category/dto/update-category.dto.ts` | Switch PartialType to @nestjs/swagger |
| `src/modules/service/service.service.ts` | Fix imports, remove AppSuccess, use ServiceStatusDto |
| `src/modules/service/service.controller.ts` | Fix import, add @ApiTags, @ResponseMessage, swagger decorators |
| `src/modules/service/dto/create-service.dto.ts` | Add @ApiProperty |
| `src/modules/service/dto/update-service.dto.ts` | Switch PartialType to @nestjs/swagger |
| `src/modules/order/order.service.ts` | Thin facade delegating to sub-services |
| `src/modules/order/order.controller.ts` | Remove console.log, replace inline types with DTOs, add @ApiTags, @ResponseMessage, swagger decorators |
| `src/modules/order/order.module.ts` | Fix import paths, add sub-services to providers |
| `src/modules/order/dto/create-order.dto.ts` | Add @ApiProperty |
| `src/modules/order/dto/update-order.dto.ts` | Fix import, switch PartialType, add @ApiProperty |
| `src/modules/order/dto/update-order-services.dto.ts` | Add @ApiProperty |

**Untouched (backups)**: `src/branch/`, `src/category/`, `src/service/`, `src/order/`

---

## Verification

1. `npx tsc --noEmit` — zero TypeScript errors
2. `GET /api/docs` — Swagger UI shows Branch, Category, Service, Order tags with all endpoints documented
3. Manual API response checks — every endpoint returns identical shape to before:
   - `GET /api/branch` → `{ data: { branches: [...] }, message: 'Branches found successfully', statusCode: 200 }`
   - `GET /api/category` → `{ data: { categories: [...] }, message: 'Categories found successfully', statusCode: 200 }`
   - `GET /api/order` → `{ data: {...}, message: 'Orders fetched successfully', statusCode: 200 }`
4. Bug-fix checks:
   - `GET /api/category/:nonexistent-id` → 404 NotFoundException (was 500 TypeError before fix)
   - Hitting any order endpoint → no `console.log` output in server terminal
