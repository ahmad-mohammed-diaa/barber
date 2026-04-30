# Plan: Fix CheckPassword Double-Wrapped Response

## Date

2026-04-23

## Type

Fix

## Objective

Make `POST /admin/check-password` return `{ data: boolean, message, statusCode }` instead of `{ data: { data: boolean }, message, statusCode }`.

## Root Cause

`AdminMutationService.CheckPassword` returns `{ data: false }` or `{ data: true }`. This object has a `data` key but no `message` key. The global `TransformResponseInterceptor` only passes through responses that already have a `message` key — otherwise it wraps the raw return in `AppSuccess`. So `{ data: false }` gets wrapped into `{ data: { data: false }, message: "Success", statusCode: 200 }`. The API contract documents the response data as `boolean`, not `{ data: boolean }`.

File: `src/modules/admin/services/admin-mutation.service.ts`, lines 91–94.

## Scope

- Files to modify:
  - `src/modules/admin/services/admin-mutation.service.ts`
- Files to create: none
- Files to delete: none

## Implementation Steps

1. Replace both `return { data: false }` with `return false`.
2. Replace `return { data: true }` with `return true`.
3. The interceptor will wrap `false` or `true` into `{ data: false, message: "Success", statusCode: 200 }` — which matches the api-contracts.md documented shape.
4. Run `npx tsc --noEmit`.

## Guards & Edge Cases

- The `@ResponseMessage()` decorator on the controller endpoint (if present) will set the `message` field — verify the swagger doc and controller for this endpoint do not override the shape
- Do not change the controller method — only the service return values

## How to Verify

- `npx tsc --noEmit` passes
- `POST /admin/check-password` with a valid password returns `{ data: true, message: "...", statusCode: 200 }` — not `{ data: { data: true }, ... }`

## Status

[x] In Progress [x] Implemented [x] Verified
