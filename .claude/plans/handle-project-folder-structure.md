# Plan: Handle Project Folder Structure

## Date

2026-04-30

## Type

Refactor

## Objective

Delete 15 stale legacy module duplicates from `src/` root, then consolidate all scattered helper/utility folders into `src/common/` so every import uses the `@/common/` alias consistently.

## Scope

### Files to delete (legacy module duplicates — safe, not imported by any active code)
- `src/admin/`
- `src/auth/`
- `src/branch/`
- `src/category/`
- `src/client-packages/`
- `src/complain/`
- `src/notification/`
- `src/order/`
- `src/package/`
- `src/points/`
- `src/product/`
- `src/promo-code/`
- `src/service/`
- `src/static/`
- `src/user/`

### Files to move (helper folders → `src/common/`)

| From | To |
|------|-----|
| `src/class-type/translation.ts` | `src/common/class-type/translation.ts` |
| `src/class-type/users.ts` | `src/common/class-type/users.ts` |
| `src/utils/AppSuccess.ts` | `src/common/utils/AppSuccess.ts` |
| `src/utils/constants.ts` | `src/common/utils/constants.ts` |
| `src/utils/generate.ts` | `src/common/utils/generate.ts` |
| `src/utils/generateSlot.ts` | `src/common/utils/generateSlot.ts` |
| `src/utils/lib.ts` | `src/common/utils/lib.ts` |
| `src/utils/not-found.filter.ts` | `src/common/utils/not-found.filter.ts` |
| `src/config/multer.config.ts` | `src/common/config/multer.config.ts` |
| `src/config/cacheManager.module.ts` | `src/common/config/cacheManager.module.ts` |
| `guard/auth.guard.ts` (root) | `src/common/guard/auth.guard.ts` |
| `guard/role.guard.ts` (root) | `src/common/guard/role.guard.ts` |
| `guard/optional-auth.guard.ts` (root) | `src/common/guard/optional-auth.guard.ts` |
| `guard/accept.language.ts` (root) | `src/common/guard/accept.language.ts` |
| `decorators/accept.language.ts` (root) | `src/common/decorators/accept.language.ts` |
| `decorators/roles.decorator.ts` (root) | `src/common/decorators/roles.decorator.ts` |
| `decorators/user.decorator.ts` (root) | `src/common/decorators/user.decorator.ts` |
| `filters/validation-fields-only.filter.ts` (root) | `src/common/filters/validation-fields-only.filter.ts` |
| Root `lib/lib.ts` `TranslateName` function | merge into `src/common/lib/lib.ts` |

### Files to modify (import path updates)
- All `src/modules/**/*.ts` files importing from `class-type`, `utils`, `config`, `guard`, `decorators`, root `lib/lib` (~85 import statements across ~45 files)
- `src/main.ts` — `./utils/not-found.filter` and `../filters/validation-fields-only.filter`
- `src/common/lib/lib.ts` — add `TranslateName` export from root lib/lib.ts

### Root-level folders to delete after move
- `guard/` (project root)
- `decorators/` (project root)
- `lib/` (project root)
- `filters/` (project root)

### Files to keep unchanged
- `src/mock/`, `src/paymob/`, `src/sms/` — still imported by `app.module.ts`, not yet migrated
- `src/prisma/` — core service, imported across all modules, not a "helper"
- `src/token.service.ts` — registered directly in AppModule
- `src/main.ts`, `src/app.module.ts` — only import paths updated, not moved

## Implementation Steps

1. **Delete the 15 legacy module folders** from `src/` root (rm -rf each)

2. **Move `src/class-type/` → `src/common/class-type/`**
   - Copy both files, then update all imports using relative paths:
     - From `src/modules/{name}/*.ts` → `../../common/class-type/translation`
     - From `src/modules/{name}/dto/*.ts` or `services/*.ts` → `../../../common/class-type/translation`
   - Delete original `src/class-type/`

3. **Move `src/utils/` → `src/common/utils/`**
   - Copy all 6 files, then update all imports using relative paths:
     - From `src/modules/{name}/*.ts` → `../../common/utils/X`
     - From `src/modules/{name}/dto/*.ts` or `services/*.ts` → `../../../common/utils/X`
   - Update `src/main.ts`: `./utils/not-found.filter` → `./common/utils/not-found.filter`
   - Delete original `src/utils/`

4. **Move `src/config/` → `src/common/config/`**
   - Copy both files, then update all imports using relative paths:
     - From `src/modules/{name}/*.ts` → `../../common/config/X`
   - Delete original `src/config/`

5. **Move root `guard/` → `src/common/guard/`**
   - Copy all 4 files into already-existing empty `src/common/guard/`
   - Update all imports using relative paths:
     - From `src/modules/{name}/*.ts` → `../../common/guard/X`
     - From `src/modules/{name}/services/*.ts` → `../../../common/guard/X`
   - Delete root `guard/`

6. **Move root `decorators/` → `src/common/decorators/`**
   - Copy 3 files into `src/common/decorators/` (alongside existing `response-message.decorator.ts`)
   - Update all imports using relative paths:
     - From `src/modules/{name}/*.ts` → `../../common/decorators/X`
     - From `src/modules/{name}/services/*.ts` → `../../../common/decorators/X`
   - Delete root `decorators/`

7. **Merge root `lib/lib.ts` into `src/common/lib/lib.ts`**
   - Add the `TranslateName` export to `src/common/lib/lib.ts`
   - Update `src/modules/admin/services/admin-query.service.ts`: `../../../../lib/lib` → `../../common/lib/lib`
   - Delete root `lib/`

8. **Move root `filters/` → `src/common/filters/`**
   - Copy `validation-fields-only.filter.ts` into `src/common/filters/`
   - Update `src/main.ts`: `../filters/validation-fields-only.filter` → `./common/filters/validation-fields-only.filter`
   - Delete root `filters/`

9. **Run `npx tsc --noEmit`** — fix any remaining path errors

10. **Single commit**: `refactor(structure): consolidate helpers into src/common and remove legacy module duplicates`

## Reuse & Conventions

- Existing logic to reuse: all files are moved as-is, zero logic changes
- Import convention: **relative paths only** — never `@/` alias, never `src/` prefix. Navigate with `../../` from `src/modules/{name}/`, `../../../` from `src/modules/{name}/services/` or `dto/`
- Patterns to follow: `src/common/lib/lib.ts` already exports with named exports, keep the same style

## Performance Considerations

- Memoization needed: No
- Lazy loading needed: No
- Algorithm complexity reviewed: No — pure file move + import update, no logic change

## Guards & Edge Cases

- `src/prisma/` is NOT moved — it's used across all modules and is more of a core service than a helper
- `src/mock/`, `src/paymob/`, `src/sms/` are NOT deleted — still active in `app.module.ts`
- Root `guard/accept.language.ts` and `decorators/accept.language.ts` appear to be different files (guard vs decorator) — both need to move to their respective target folders under `src/common/`
- `src/common/guard/` and `src/common/filters/` already exist as empty directories — no mkdir needed
- `src/common/decorators/` already has `response-message.decorator.ts` — do not overwrite it
- Root `lib/lib.ts` has `TranslateName` (different from `getTranslationNames` in `src/common/lib/lib.ts`) — these must both exist as named exports in the merged file
- API response shapes: not touched — this is a pure file-move refactor

## How to Verify

- `npx tsc --noEmit` passes with zero errors
- `npm run start:dev` boots without import errors
- No references to old paths remain: `grep -rn "from.*'../../../guard\|from.*'../../../decorators\|from.*class-type\|from.*src/utils\|from.*src/config\|from.*../../../../lib\|from.*@/" src/modules/`

## Status

[ ] In Progress [ ] Implemented [ ] Verified
