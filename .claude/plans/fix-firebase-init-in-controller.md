# Plan: Fix Firebase initializeApp in Controller Constructor

## Date
2026-04-23

## Type
Fix

## Objective
Move `admin.initializeApp()` out of the controller constructor and into a module-level provider so it runs exactly once.

## Root Cause
`NotificationController` calls `admin.initializeApp({ ... })` in its constructor. NestJS may instantiate controllers more than once (e.g. during testing, module reloads, or if the module is imported multiple times). Firebase throws `FirebaseAppError: Firebase App named '[DEFAULT]' already exists` on any subsequent call. The controller constructor is the wrong place for a singleton initialization.

File: `src/modules/notification/notification.controller.ts`, lines 32–41.

## Scope
- Files to modify:
  - `src/modules/notification/notification.module.ts` — add Firebase initialization as a module-level `onModuleInit` or factory provider
  - `src/modules/notification/notification.controller.ts` — remove `initializeApp` call from constructor
- Files to create: none
- Files to delete: none

## Implementation Steps
1. In `notification.module.ts`, implement `OnModuleInit` on the module class:
   ```ts
   import { Module, OnModuleInit } from '@nestjs/common';
   import * as admin from 'firebase-admin';

   export class NotificationModule implements OnModuleInit {
     onModuleInit() {
       if (!admin.apps.length) {
         admin.initializeApp({
           credential: admin.credential.cert({
             projectId: process.env.FIREBASE_PROJECT_ID,
             privateKey: (process.env.FIREBASE_PRIVATE_KEY as string).replace(/\\n/g, '\n'),
             clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
           }),
         });
       }
     }
   }
   ```
2. In `notification.controller.ts`, remove the `admin` import and the entire `initializeApp(...)` block from the constructor. Keep the constructor with only its service injections.
3. Run `npx tsc --noEmit`.

## Guards & Edge Cases
- `admin.apps.length` guard prevents double-init if the module is somehow loaded twice
- The `notification-mutation.service.ts` and `notificationScheduler.ts` already use `admin.messaging()` directly — they do not call `initializeApp` themselves, so no other files need updating

## How to Verify
- `npx tsc --noEmit` passes
- `npm run start:dev` boots without Firebase errors
- Sending a notification still works end-to-end

## Status
[ ] In Progress [ ] Implemented [ ] Verified
