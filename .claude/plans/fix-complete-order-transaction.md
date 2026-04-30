# Plan: Fix completeOrder Broken Transaction

## Date
2026-04-23

## Type
Fix

## Objective
Ensure all writes inside `completeOrder` use the transaction-scoped client so they are atomic.

## Root Cause
`OrderLifecycleService.completeOrder` opens `this.prisma.$transaction(async (prisma) => { ... })` but then calls `this.prisma.order.update(...)` using the outer injected client instead of the `prisma` transaction argument. Any subsequent failure after the `order.update` (e.g. the notification send throws) cannot roll back the order status change because it was written outside the transaction boundary.

File: `src/modules/order/services/order-lifecycle.service.ts`, line ~37.

## Scope
- Files to modify:
  - `src/modules/order/services/order-lifecycle.service.ts`
- Files to create: none
- Files to delete: none

## Implementation Steps
1. Read the full `completeOrder` method.
2. Inside the `$transaction` callback, replace every `this.prisma.X` call with `prisma.X` (the transaction argument).
3. The `notificationService.sendNotification(...)` call is a side effect (Firebase, not DB) and cannot be inside a DB transaction — move it to after the transaction resolves. Assign the transaction result to a variable, then call `sendNotification` after the `await this.prisma.$transaction(...)` line.
4. Run `npx tsc --noEmit`.

## Guards & Edge Cases
- The notification send can fail independently of the DB write — this is acceptable; the order is already COMPLETED in the DB and the client will see it. Do not wrap the notification call in the transaction.
- Response shape must not change — return the `updatedOrder` object exactly as before (same fields, same structure from the Prisma include).

## How to Verify
- `npx tsc --noEmit` passes
- Simulate a notification failure mid-complete — order status should remain COMPLETED in DB (it was committed), not rolled back

## Status
[x] In Progress [x] Implemented [x] Verified
