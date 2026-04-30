# Plan: Extract OrderSharedService from Create and Review

## Date

2026-04-30

## Type

Refactor

## Objective

Extract the 5 identical methods shared between `OrderCreateService` and `OrderReviewService` into a single `OrderSharedService`, injected into both — eliminating ~120 lines of duplication.

## Scope

- Files to create:
  - `src/modules/order/services/order-shared.service.ts`
- Files to modify:
  - `src/modules/order/services/order-create.service.ts` — inject `OrderSharedService`, remove 5 duplicated methods, call shared ones
  - `src/modules/order/services/order-review.service.ts` — inject `OrderSharedService`, remove 5 duplicated methods, call shared ones
  - `src/modules/order/order.module.ts` — register `OrderSharedService` as a provider
- Files to delete: none

## Methods to move into OrderSharedService

| Method | Signature |
|---|---|
| `resolveUserId` | `(phone, userId) → Promise<string>` |
| `fetchServices` | `(serviceIds) → Promise<{ fetchedServices, totalDuration }>` |
| `resolveServiceList` | `(userId, role, fetchedServices, usedPackage) → Promise<{ allServices, costServices }>` |
| `calculatePricing` | `(costServices, points, usedPromoCode, validPromoCode) → PricingResult` |
| `buildDiscountDisplay` | `(validPromoCode, pointsDiscount, discount) → string` |

## Methods that stay in each service (too different to share)

- `fetchParallelData` — review selects `firstName/lastName/phone`; create does not
- `validateRules` — create unconditionally throws if `!user` and checks `ban`; review only throws if `phone && !user`

## Implementation Steps

1. **Create `order-shared.service.ts`**
   - `@Injectable()` class with `PrismaService`, `PromoCodeService`, `OrderPricingService` injected
   - Move the 5 methods verbatim from `OrderReviewService` (they are the canonical, up-to-date versions — review has the early-exit fix for `resolveServiceList`)
   - Move the `ServiceWithFreeFlag` and `PricingResult` interfaces here and export them so both services can import them

2. **Update `OrderReviewService`**
   - Inject `OrderSharedService`
   - Remove the 5 moved methods and their interfaces
   - Replace each call site with `this.orderShared.methodName(...)`
   - Remove `PromoCodeService` and `OrderPricingService` from its own constructor — they are now only needed by `OrderSharedService`

3. **Update `OrderCreateService`**
   - Inject `OrderSharedService`
   - Remove the 5 duplicated methods (they exist inline, not as named private methods)
   - Replace their inline logic with calls to `this.orderShared.methodName(...)`
   - Remove `PromoCodeService` and `OrderPricingService` from its own constructor
   - Apply the `resolveServiceList` early-exit fix (already in shared version)

4. **Register in `order.module.ts`**
   - Add `OrderSharedService` to `providers`

5. **Run `npx tsc --noEmit`**

## Reuse & Conventions

- Existing logic to reuse: the `OrderReviewService` versions of all 5 methods are canonical (have the latest fixes)
- Patterns to follow: same facade/sub-service pattern used across all modules

## Performance Considerations

- Memoization needed: No
- Lazy loading needed: No
- Algorithm complexity reviewed: No — pure extraction, no logic change

## Guards & Edge Cases

- `OrderCreateService` currently always fetches `clientPackages` unconditionally (no early-exit for empty). The shared `resolveServiceList` already has the early-exit. This is a behaviour improvement, not a breaking change — result is identical.
- `PromoCodeService` and `OrderPricingService` must be removed from `OrderReviewService` and `OrderCreateService` constructors only if they are no longer used directly in those services after the extraction. Verify before removing.
- API response shapes: unchanged — only internals move

## How to Verify

- `npx tsc --noEmit` passes
- No duplicate method bodies remain across the three files
- `grep -n "resolveUserId\|fetchServices\|resolveServiceList\|calculatePricing\|buildDiscountDisplay" src/modules/order/services/order-{create,review}.service.ts` — should show only call sites, no definitions

## Status

[ ] In Progress [ ] Implemented [ ] Verified
