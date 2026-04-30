# Plan: Fix Production console.log Leaking Sensitive Data

## Date

2026-04-23

## Type

Fix

## Objective

Remove all raw `console.log` calls from notification services that leak FCM tokens, raw user objects, and internal state to stdout in production.

## Root Cause

`notification-mutation.service.ts` logs `fcmToken`, the full `user` object, and the `token` response to stdout (lines 12, 13, 23). `notificationScheduler.ts` logs execution strings to stdout (lines 21, 40) bypassing the Logger already configured on the class. FCM tokens are sensitive device identifiers; user objects may contain PII.

## Scope

- Files to modify:
  - `src/modules/notification/services/notification-mutation.service.ts`
  - `src/modules/notification/services/notificationScheduler.ts`
- Files to create: none
- Files to delete: none

## Implementation Steps

### notification-mutation.service.ts

1. Remove `console.log(fcmToken)` (line 12).
2. Remove `console.log(user)` (line 13).
3. Remove `console.log(token)` (line 23).
4. Remove `console.log(error)` in `sendNotificationToAllUsers` catch block — replace with `this.logger.error(error)` (add a `Logger` to the class if not already present).

### notificationScheduler.ts

1. Replace `console.log('notification send successfully')` with `this.logger.log('Checking upcoming orders...')` — the logger call already exists on line 18; remove the duplicate console.
2. Replace `console.log('no upcoming orders found')` with `this.logger.debug('No upcoming orders')` or remove entirely.

## How to Verify

- `npx tsc --noEmit` passes
- `npm run start:dev` produces no FCM token or user object output in the terminal

## Status

[x] In Progress [x] Implemented [x] Verified
