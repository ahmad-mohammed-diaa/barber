# Plan: Skip Package Mapping When User Has No Packages

## Date

2026-04-30

## Type

Fix

## Objective

In `resolveServiceList`, skip the entire single/free-flag mapping when the user has no active packages — return all services as paid immediately instead of running unnecessary mapping logic.

## Root Cause

`resolveServiceList` always runs the full `single` array build and `isFree` mapping for any USER role, even when `clientPackages` is empty. The mapping produces correct results (all `isFree: false`) but wastes computation and obscures intent. The clean path (no packages → all services cost money) should be explicit and reached without the detour.

## Scope

- Files to modify:
  - `src/modules/order/services/order-review.service.ts` — `resolveServiceList` only
- Files to create: none
- Files to delete: none

## Implementation Steps

1. After fetching `clientPackages`, check `if (clientPackages.length === 0)`.
2. If true: push all `fetchedServices` with `isFree: false`, skip all mapping, return early.
3. If false (user has packages): run the existing single/free-flag logic unchanged.

## Before / After

**Before** (always maps even with no packages):
```ts
if (role === 'USER') {
  const clientPackages = await ...findMany(...);

  // always runs even if clientPackages is empty
  const single = clientPackages.filter(...).flatMap(...);
  allServices.push(...fetchedServices.map(srv => ({ ...srv, isFree: single.some(...) })));
  ...
}
```

**After**:
```ts
if (role === 'USER') {
  const clientPackages = await ...findMany(...);

  if (clientPackages.length === 0) {
    allServices.push(...fetchedServices.map(srv => ({ ...srv, isFree: false })));
  } else {
    // existing single/free-flag mapping — unchanged
    const single = clientPackages.filter(...).flatMap(...);
    allServices.push(...fetchedServices.map(srv => ({ ...srv, isFree: single.some(...) })));
    ...
  }
}
```

## Reuse & Conventions

- Existing logic to reuse: the full package-mapping block stays intact inside the `else` branch — zero changes to it
- Patterns to follow: early-return style already used elsewhere in the service

## Performance Considerations

- Memoization needed: No
- Lazy loading needed: No
- Algorithm complexity reviewed: Yes — early exit avoids O(n×m) `single.some()` scan when n=0

## Guards & Edge Cases

- `usedPackage` may be non-empty even when `clientPackages` is empty (client sent an invalid package id). The early-return path ignores `usedPackage` in this case — which is correct, since `clientPackages.length === 0` means the DB returned no active packages for this user, so the `usedPackage` ids are invalid. The `selectedPackage` filter would have caught this anyway (filtering to empty).
- Non-USER roles are untouched — they still go through the plain `isFree: false` path.
- Response shape is unchanged — `allServices` and `costServices` are the same types and structure.

## How to Verify

- `npx tsc --noEmit` passes
- USER with no packages: all services in `costServices`, none in `allServices` marked free
- USER with SINGLE packages: services matching the package are still marked `isFree: true`
- USER with MULTIPLE packages in `usedPackage`: still appended as `isFree: true`

## Status

[ ] In Progress [ ] Implemented [ ] Verified
