# Plan: Fix Legacy Module Import Paths

## Date

2026-04-23

## Type

Fix

## Objective

Replace all legacy `src/` import paths with correct `src/modules/` paths in the active order and package modules.

## Root Cause

`order.module.ts`, `order-booking.service.ts`, `order-lifecycle.service.ts`, and `package.module.ts` import `PromoCodeService` and `NotificationService` from the inactive legacy directories (`src/promo-code/`, `src/notification/`) instead of the active modules at `src/modules/promo-code/` and `src/modules/notification/`. TypeScript resolves the import against the legacy class type, meaning the DI token at runtime (from the active module) and the compile-time type (from the legacy module) may diverge if the two classes ever differ.

## Scope

- Files to modify:
  - `src/modules/order/order.module.ts`
  - `src/modules/order/services/order-booking.service.ts`
  - `src/modules/order/services/order-lifecycle.service.ts`
  - `src/modules/package/package.module.ts`
- Files to create: none
- Files to delete: none

## Implementation Steps

1. In `order.module.ts`: replace `../../promo-code/promo-code.service` → `../promo-code/promo-code.service` (within modules/); replace `../../notification/notification.service` → `../notification/notification.service`.
2. In `order-booking.service.ts`: replace `../../../promo-code/promo-code.service` → `../../promo-code/promo-code.service`.
3. In `order-lifecycle.service.ts`: replace `../../../notification/notification.service` → `../../notification/notification.service`; replace `../../../promo-code/promo-code.service` → `../../promo-code/promo-code.service`.
4. In `package.module.ts`: replace `src/notification/notification.service` (absolute legacy) → relative `../notification/notification.service`.
5. Run `npx tsc --noEmit` — must pass with zero errors.

## Reuse & Conventions

- Relative paths only — `@/` alias does not cover `src/modules/`

## How to Verify

- `npx tsc --noEmit` passes
- `npm run start:dev` boots without DI resolution errors

## Status

[x] In Progress [x] Implemented [x] Verified
