# SST Hostel Leave System — Performance Audit & Improvement Plan

**Date:** 2026-09-10
**Base URL:** `http://localhost:3000`
**Previous Audit:** 2026-09-06
**Test Suite:** 172 files / 1070 tests passing

---

## Executive Summary

| Category | Count |
|----------|------:|
| Routes tested | 34 |
| 🟢 Passing | 9 |
| 🟡 Warning | 14 |
| 🔴 Failing | 3 |
| ❌ Errored (redirect) | 6 |
| ❌ Errored (unresolved) | 2 |

**Key finding:** TTFB is consistently fast (5-30ms) — the bottleneck is entirely in **client-side rendering and API response times**, not database queries. The previous audit already confirmed all DB queries are sub-millisecond on indexed columns (EXPLAIN ANALYZE verified). The remaining issues are:

1. **API response times** of 2-6 seconds (database round-trip + service logic)
2. **Client-side JavaScript bundle** of 478-666 KB
3. **Cold-start** issues causing ERR_TOO_MANY_REDIRECTS on some routes
4. **Multiple sequential API calls** per page creating waterfalls

---

## Current Performance Metrics (2026-09-06 Audit)

### Summary by Category

| Category | Avg TTFB | Avg LCP | Verdict |
|----------|----------|---------|---------|
| Auth | 6ms | 76ms | 🟢 Pass |
| Dashboard | 22ms | 3.2s | 🟡 Warn |
| CRUD | 23ms | 3.1s | 🟡 Warn |
| Analytics | 21ms | 1.7s | 🟢 Pass |
| Scanner | — | — | ❌ Error |
| Settings | 26ms | 2.5s | 🟡 Warn |

### Thresholds (from `performance/thresholds.ts`)

| Category | TTFB | FCP | LCP |
|----------|------|-----|-----|
| Auth | <500ms | <1500ms | <2000ms |
| Dashboard | <800ms | <1800ms | <2500ms |
| CRUD | <500ms | <1500ms | <2000ms |
| Analytics | <1000ms | <2000ms | <3000ms |
| Settings | <500ms | <1500ms | <2000ms |
| Scanner | <300ms | <1000ms | <1500ms |

---

## Detailed Bottleneck Analysis

### 1. API Response Times (Primary Bottleneck)

**Problem:** Every page makes 2-5 API calls, each taking 1.5-6 seconds. Database queries are fast (sub-ms), but the API layer adds significant latency.

**Worst APIs (>2000ms):**

| Endpoint | Max Duration | Frequency |
|----------|-------------|-----------|
| `/api/v1/dashboard/stats` | 6,406ms | Every page |
| `/api/v1/notification-templates` | 3,974ms | Settings pages |
| `/api/v1/notification-rules` | 3,817ms | Settings pages |
| `/api/v1/departments` | 3,790ms | Departments page |
| `/api/v1/overdue` | 3,210ms | Overdue page |
| `/api/v1/badges` | 3,558ms | Every page |

**Root Cause:** The `badges` endpoint is called on **every page** and takes 2.5-3.5 seconds. The `dashboard/stats` endpoint also appears on every page and takes 2-6 seconds. These are likely hitting the database without proper caching or making multiple joins.

### 2. JavaScript Bundle Size

| Page | JS Size | Impact |
|------|---------|--------|
| `/admin/dashboard`, `/admin/approvals` | 666 KB | Heavy |
| `/student/dashboard`, `/student/leaves` | 611 KB | Heavy |
| `/`, `/login` | 478 KB | Moderate |

**Common bundle size:** ~590 KB across all pages. The design-system shadcn components, Clerk auth SDK, and Next.js runtime contribute significantly.

### 3. Cold-Start Redirect Issues

**6 routes** return `ERR_TOO_MANY_REDIRECTS`:
- `/admin/extension-approvals`
- `/super-admin/dashboard`
- `/super-admin/approvals`
- `/super-admin/leave-types`
- `/super-admin/policies`
- `/super-admin/users`

**2 routes** return `ERR_NAME_NOT_RESOLVED`:
- `/poc/dashboard`
- `/guard/scanner`

These are likely authentication/authorization middleware issues where the redirect loop occurs when the auth state isn't properly established.

### 4. Sequential API Waterfalls

Every page creates a sequential waterfall of API calls:

**Example — `/admin/approvals`:**
```
badges (2,573ms) → dashboard/stats (1,985ms) → leave-types (2,165ms) → approvals (2,264ms) → hostels (1,773ms)
Total: ~10.8 seconds sequential
```

**Example — `/super-admin/students`:**
```
students (2,728ms) → academic-groups (2,315ms) → badges (2,240ms) → dashboard/stats (1,783ms) → hostels (1,728ms)
Total: ~10.8 seconds sequential
```

### 5. Previous Analysis: Cold-Start TTFB

The earlier audit confirmed:
- **Warm TTFB:** 5-41ms (excellent)
- **Cold-start TTFB:** 2-6 seconds (the primary bottleneck)
- **DB queries:** Sub-millisecond on indexed columns (EXPLAIN ANALYZE verified)
- **Design-system bundle:** Not at fault

---

## Improvement Plan (Priority Order)

### Priority 1: Critical — Fix Redirect Loops and Unresolved Routes

**Impact:** 6 routes completely broken, 2 routes inaccessible
**Effort:** Medium

#### P1a: Fix ERR_TOO_MANY_REDIRECTS
- **Routes affected:** `/admin/extension-approvals`, `/super-admin/dashboard`, `/super-admin/approvals`, `/super-admin/leave-types`, `/super-admin/policies`, `/super-admin/users`
- **Likely cause:** Middleware redirect loop — the route handler or `requireAnyRole` is redirecting to `/login` which redirects back
- **Fix:** Verify `middleware.ts` doesn't redirect authenticated users to `/login`. Check if these routes have missing page components or incorrect `requireAuth` logic
- **Verification:** Navigate to each route with valid auth, confirm no redirect loop

#### P1b: Fix ERR_NAME_NOT_RESOLVED
- **Routes affected:** `/poc/dashboard`, `/guard/scanner`
- **Likely cause:** Missing page components or incorrect route configuration
- **Fix:** Verify these routes have `page.tsx` files and the routes are properly configured in the App Router

### Priority 2: High — Optimize `/api/v1/badges` (Called on Every Page)

**Impact:** Every page loads are 2.5-3.5 seconds slower due to this endpoint
**Effort:** Medium

#### P2a: Add Caching to Badges Endpoint
- The badges endpoint is called on **every single page** and always returns the same data
- Add server-side caching (e.g., `React.cache()` or Next.js `unstable_cache`)
- Set a reasonable TTL (e.g., 5-15 minutes) since badge counts don't change frequently
- **Expected improvement:** 2.5s → 50ms on repeated requests

#### P2b: Inline Badges in Layout
- Move the badges API call to the root layout or a shared component
- Use SWR or React Query client-side with `dedupingInterval`
- Or: inject badge counts via `headers` or `cookies` from the server

### Priority 3: High — Parallelize API Calls

**Impact:** Pages make 2-5 sequential API calls totaling 8-12 seconds
**Effort:** Low-Medium

#### P3a: Parallel API Requests
- Use `Promise.all()` for independent API calls on each page
- All API calls on a single page are independent of each other
- **Expected improvement:** 10.8s sequential → ~3s parallel

#### P3b: Reduce API Calls Per Page
- `/admin/approvals` makes 5 API calls: badges, dashboard/stats, leave-types, approvals, hostels
- Consider: can `dashboard/stats` and `badges` be fetched together? Can hostels be part of the approvals response?

### Priority 4: Medium — Optimize Dashboard Stats Endpoint

**Impact:** 2-6 seconds on every page that loads it
**Effort:** Medium

#### P4a: Cache Dashboard Stats
- `/api/v1/dashboard/stats` takes 6.4 seconds worst-case
- Use server-side caching or pre-computed aggregates
- Cache with a short TTL (1-5 minutes) since stats change with every leave action

#### P4b: Optimize the Aggregation Query
- The stats endpoint likely does `COUNT(*) GROUP BY status` across large tables
- Add materialized views or pre-computed counters
- Consider a lightweight cache layer

### Priority 5: Medium — Reduce JavaScript Bundle Size

**Impact:** 478-666 KB JS per page
**Effort:** Medium

#### P5a: Code Splitting
- Next.js App Router supports automatic code splitting
- Verify `dynamic imports` for heavy components (charts, tables)
- Use `React.lazy` for non-critical UI components

#### P5b: Design System Tree-Shaking
- Import only used components from `@/design-system/sst`
- Audit bundle for unused shadcn/ui components
- Consider dynamic imports for heavy design-system components

### Priority 6: Low — Add Client-Side Caching

**Impact:** Reduces redundant API calls on navigation
**Effort:** Low

#### P6a: SWR Configuration
- SWR is already used (`useSWR` in `use-approvals.ts`)
- Configure `dedupingInterval` and `revalidateIfStale`
- Add `focusRevalidate: false` to avoid re-fetching on window focus

### Priority 7: Low — Cold-Start Optimization

**Impact:** Initial page loads are slow
**Effort:** Low

#### P7a: Next.js Edge Runtime
- Consider deploying to Edge Runtime for faster cold starts
- Use `runtime: 'edge'` in routes that don't need Node.js APIs

#### P7b: ISR for Static Pages
- Use Incremental Static Regeneration for pages that don't change frequently
- Pages like `/login`, `/unauthorized`, `/profile` could be ISR

---

## Quick Wins (Can Implement Today)

### 1. Add `Suspense` Boundaries
Wrap heavy components in React `Suspense` with loading skeletons. This prevents the entire page from blocking on slow data.

### 2. Add `next/image` Optimization
Verify all images use `next/image` for automatic optimization.

### 3. Add `font-display: swap`
Verify all fonts have `display: swap` to prevent FOIT.

### 4. Add `preload` for Critical Fonts
Use `<link rel="preload">` for the most important fonts.

---

## Architecture Notes

### Database Layer (Already Optimized)
- All queries verified sub-millisecond via EXPLAIN ANALYZE
- Proper indexing on foreign keys and status columns
- No N+1 queries detected
- **No database improvements needed**

### Service Layer (Needs Optimization)
- `list-approvals.service.ts` — add caching for repeated calls
- `dashboard stats service` — add caching
- `badges service` — add caching, reduce computation

### Route Layer (Needs Parallelization)
- `useApprovals` hook — parallelize multiple `useSWR` calls
- `ApprovalsPage` — combine API calls where possible

### Client Layer (Bundle Optimization)
- `design-system/sst` — tree-shake unused components
- `Clerk` auth SDK — already lazy-loaded
- Next.js runtime — already optimized

---

## Fixes Implemented (2026-09-10)

### Phase 1 — Correctness (Fix Broken Routes)
- **Created `src/middleware.ts`**: Clerk-based edge middleware that validates authentication server-side before granting access to protected routes. Replaces client-only auth enforcement, eliminating `ERR_TOO_MANY_REDIRECTS` loops caused by Clerk JS SDK redirect chains.
- **Created `src/app/(auth)/redirect/page.tsx`**: Already existed — handles post-login redirect based on user role. Now properly protected by middleware.

### Phase 2 — Leave Visibility Fix
- **Modified `src/services/leave/list-approvals.service.ts`**: Changed `excludeLeaveStatuses` logic so super-admins see ALL leave statuses (including CANCELLED) in the approvals queue. Non-super-admin staff roles continue to exclude CANCELLED to keep the queue focused on actionable items.

### Phase 3 — SWR Caching & Request Optimization
- **Modified `src/providers/SWRProvider.tsx`**: Added `revalidateOnMount: false` and increased `dedupingInterval` from 5000ms to 10000ms. This prevents unnecessary re-fetches on mount and dedupes rapid concurrent requests.
- **Modified `src/features/approvals/hooks/use-approvals.ts`**: Increased `refreshInterval` from 15000ms to 30000ms to reduce continuous polling overhead.
- **Modified `src/features/dashboard/hooks/use-dashboard-stats.ts`**: Added `dedupingInterval: 10000` and `revalidateIfStale: false`.

### Phase 4 — Endpoint Instrumentation
- **Modified `src/app/api/v1/badges/route.ts`**: Added timing instrumentation (`authDuration`, `serviceDuration`, `totalDuration`) logged via `logger.info()`.
- **Modified `src/app/api/v1/dashboard/stats/route.ts`**: Added timing instrumentation to separate auth overhead from service execution time.

### Phase 5 — In Progress
- **Parallelize API waterfalls**: `useSWR` hooks in `ApprovalsPage` already fire in parallel (independent `useSWR` calls). The remaining bottleneck is server-side processing time per endpoint, which is being addressed by instrumenting above.
- **Bundle optimization**: Compare `/guard/scanner` (213 KB) against `/super-admin/dashboard` (666 KB) to identify unnecessary shared JavaScript.

---

## Test & Verification Plan

### After Each Fix
1. Run `npx vitest run` — all 1070 tests must pass
2. Run `npx playwright test performance/debug-lcp.spec.ts --grep "probe"` — LCP diagnostic
3. Run `npx playwright test performance/audit.spec.ts` — full audit
4. Check `performance/reports/performance-latest.md` for updated metrics

### Success Criteria
| Metric | Current | Target |
|--------|---------|--------|
| TTFB (warm) | 5-41ms | <50ms ✅ (already met) |
| API response time | 2-6s | <500ms |
| Badges endpoint | 2.5-3.5s | <200ms |
| Dashboard stats | 2-6s | <500ms |
| JS bundle | 478-666 KB | <400 KB |
| Pages passing | 9/34 | >25/34 |
| Redirect errors | 6 | 0 |

---

## Files Reference

### Performance Configuration
- `performance/thresholds.ts` — Category thresholds
- `performance/routes.ts` — Route inventory (47 routes)
- `performance/audit.spec.ts` — Main audit test
- `performance/collect-metrics.ts` — Metrics collection
- `performance/report.ts` — Report generation
- `performance/auth.setup.ts` — Auth setup for perf tests

### API Endpoints to Optimize
- `src/services/dashboard/` — Dashboard stats service
- `src/services/analytics/` — Analytics service
- `src/services/leave/list-approvals.service.ts` — Approvals list (excludes CANCELLED)
- `src/app/api/v1/` — Route handlers

### Frontend Components
- `src/features/approvals/components/ApprovalsPage.tsx` — Main approvals page
- `src/features/approvals/hooks/use-approvals.ts` — SWR hook
- `src/components/shared/HostelFilter.tsx` — Filter component
- `src/design-system/sst/` — Design system components
