# Plan: Fix Client Packages ID Coercion Bug

## Date

2026-04-23

## Type

Fix

## Objective

Remove the `+id` numeric coercion that converts a UUID string to NaN before passing it to the service.

## Root Cause

`ClientPackagesController.update()` receives `@Param('id') id: string` (a UUID) and calls `this.clientPackagesService.update(+id)`. The `+` prefix coerces the string to a number — `+("uuid-string")` evaluates to `NaN`. Any service logic that receives `NaN` as an ID will produce a Prisma error or silently fail.

File: `src/modules/client-packages/client-packages.controller.ts`, line 56.

## Scope

- Files to modify:
  - `src/modules/client-packages/client-packages.controller.ts`
- Files to create: none
- Files to delete: none

## Implementation Steps

1. In the `update()` method, change `this.clientPackagesService.update(+id)` to `this.clientPackagesService.update(id)`.
2. Verify `ClientPackagesService.update(id: string)` signature accepts a string (it does — the stub takes `id: string`).
3. Run `npx tsc --noEmit`.

## How to Verify

- `npx tsc --noEmit` passes
- `PATCH /client-packages/:id` with a valid UUID no longer produces a NaN-related error

## Status

[ ] In Progress [x] Implemented [ ] Verified
