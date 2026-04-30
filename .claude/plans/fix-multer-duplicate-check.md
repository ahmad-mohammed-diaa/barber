# Plan: Fix Duplicate Format Check in multer.config.ts

## Date
2026-04-23

## Type
Fix

## Objective
Remove the copy-pasted duplicate `if (!formats.includes(extension))` block.

## Root Cause
`src/config/multer.config.ts` lines 24–27 contain an `if (!formats.includes(extension)) throw UnsupportedMediaTypeException` block. Lines 27–29 immediately repeat the identical check with the identical throw. The second block is dead code — it can never be reached because the first block already threw. This is a copy-paste error.

## Scope
- Files to modify:
  - `src/config/multer.config.ts`
- Files to create: none
- Files to delete: none

## Implementation Steps
1. Delete lines 27–29 (the second identical `if (!formats.includes(extension))` block).
2. Run `npx tsc --noEmit`.

## How to Verify
- `npx tsc --noEmit` passes
- Uploading an invalid file type still returns 415 Unsupported Media Type

## Status
[x] In Progress [x] Implemented [x] Verified
