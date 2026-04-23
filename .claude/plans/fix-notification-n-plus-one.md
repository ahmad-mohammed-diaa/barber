# Plan: Fix N+1 DB Writes in sendNotificationToAllUsers

## Date
2026-04-23

## Type
Fix

## Objective
Replace individual per-user `prisma.user.update` calls with a single `prisma.notification.createMany` to write notification history in one DB round-trip.

## Root Cause
`NotificationMutationService.sendNotificationToAllUsers` fetches all users with FCM tokens, then maps over them calling `prisma.user.update` for each user inside `Promise.all`. This creates one DB write per user. With 1,000 users that is 1,000 simultaneous DB connections — a connection pool exhaustion risk and an N+1 pattern.

File: `src/modules/notification/services/notification-mutation.service.ts`, lines 113–128.

## Scope
- Files to modify:
  - `src/modules/notification/services/notification-mutation.service.ts`
- Files to create: none
- Files to delete: none

## Implementation Steps
1. Read the Prisma `notification` model schema to confirm the fields (`userId`, `title`, `content`, `image`).
2. Replace the `users.map(u => prisma.user.update(...))` spread inside `Promise.all` with a single:
   ```ts
   this.prisma.notification.createMany({
     data: users.map((u) => ({
       userId: u.id,
       title: body.title,
       content: body.message,
       ...(body.imageUrl && { image: body.imageUrl }),
     })),
   })
   ```
3. Keep the Firebase `admin.messaging().send(topicMessage)` call in `Promise.all` alongside the single `createMany`.
4. Verify the response shape is unchanged — method returns `new AppSuccess(noti, 'Notification sent to all users successfully')` where `noti` is the Firebase send result. Keep that.
5. Run `npx tsc --noEmit`.

## Guards & Edge Cases
- Confirm `notification` model has a direct `userId` field (not nested under `user.notification.create`) — if schema uses the nested relation, keep the nested approach but use `createMany` at the `notification` model level directly
- `createMany` does not trigger Prisma middleware — acceptable here since this is a bulk write

## How to Verify
- `npx tsc --noEmit` passes
- Sending a broadcast notification creates one DB write total, not N writes

## Status
[ ] In Progress [ ] Implemented [ ] Verified
