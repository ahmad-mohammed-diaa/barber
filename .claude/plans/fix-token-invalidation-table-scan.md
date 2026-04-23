# Plan: Fix Token Invalidation Table Scan

## Date
2026-04-23

## Type
Fix

## Objective
Stop `invalidateAllUserTokens` from fetching every row in the Token table and decoding JWTs in memory; instead filter by userId directly in the DB query.

## Root Cause
`TokenOperationsService.invalidateAllUserTokens(userId)` calls `prisma.token.findMany()` with no WHERE clause, loads every token in the database into memory, then calls `jwt.decode()` on each one to find tokens belonging to `userId`. This is O(n) on the entire Token table. The Token model has no `userId` column, so there is no DB-level filter available. This must be fixed at the schema level.

## Scope
- Files to create: `prisma/migrations/{timestamp}_add_userid_to_token/migration.sql` (auto-generated)
- Files to modify:
  - `prisma/schema.prisma` — add `userId String?` and relation to Token model
  - `src/modules/auth/services/token-operations.service.ts` — update `loginToken` to store userId; update `invalidateAllUserTokens` to use `deleteMany`

## Implementation Steps
1. In `prisma/schema.prisma`, add to the Token model:
   ```
   userId    String?
   ```
   (nullable — existing tokens have no userId and must remain valid)
2. Run `npx prisma migrate dev --name add_userid_to_token`. Review the generated SQL before applying.
3. In `token-operations.service.ts`, update `generateToken(userId)`:
   - Pass `userId` into `loginToken(token, userId)`
4. Update `loginToken(token, userId?)`:
   - Store `userId` in `prisma.token.create({ data: { token, expiredAt, userId } })`
5. Update `invalidateAllUserTokens(userId)`:
   - Replace the `findMany` + in-memory decode loop with `prisma.token.deleteMany({ where: { userId } })`
6. Run `npx tsc --noEmit`.

## Guards & Edge Cases
- Existing tokens in the DB have `userId = null` — `deleteMany({ where: { userId } })` will not touch them (correct: they expire naturally)
- `loginToken` already handles the non-object decoded JWT case — keep that guard
- Do not change `invalidateToken(token)` (single logout) — it uses the `token` field, unaffected

## How to Verify
- `npx prisma migrate dev` applies cleanly
- `npx tsc --noEmit` passes
- Login → change password → old token rejected on next request

## Status
[ ] In Progress [ ] Implemented [ ] Verified
