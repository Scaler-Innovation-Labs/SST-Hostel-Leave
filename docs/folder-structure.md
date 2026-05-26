# Folder Structure

SST Hostel Leave System uses a route-grouped Next.js App Router layout with clear ownership boundaries for UI, features, infrastructure, and persistence.

## `src/app/`

Route groups keep auth and dashboard surfaces separate.

- `src/app/(auth)/` handles login, redirects, and Clerk-related entry points.
- `src/app/(dashboard)/` contains protected student, admin, POC, and super-admin areas.
- `src/app/page.tsx` is the marketing homepage.
- `src/proxy.ts` is the active Next.js request gate for this version of Next.js.
- `src/middleware.ts` is present as a compatibility alias for the older convention.

## `src/components/`

Reusable presentation infrastructure only.

- `src/components/marketing/` contains homepage/marketing sections.
- `src/components/layout/` contains app shell primitives and dashboard chrome such as `AppShell`, `DashboardNavbar`, and `DashboardSidebar`.
- `src/components/shared/` contains reusable primitives like `Logo`, `StatusBadge`, and `DataTable`.
- `src/components/ui/` contains the shadcn/ui building blocks.

## `src/features/`

Feature-owned logic is grouped by domain.

- `src/features/auth/`
- `src/features/leaves/`
- `src/features/movements/`
- `src/features/notifications/`
- `src/features/qr/`
- `src/features/workflows/`
- `src/features/dashboard/` remains as a domain area, but its shell responsibility moved into `src/components/layout/AppShell.tsx`.

Each feature is expected to own its own:

- `components/`
- `hooks/`
- `types/`
- `validators/`
- `actions/`
- `utils/`

## `src/constants/`

- `src/constants/routes.ts` centralizes route strings.
- `src/constants/navigation.ts` defines route-aware navigation data.

## `src/lib/`

Infrastructure utilities and platform helpers only.

- `src/lib/auth/` contains auth helpers, guards, roles, and RBAC policy utilities.
- `src/lib/utils.ts` remains the shared helper entry point.

## `src/providers/`

App-level providers such as `ThemeProvider` and `SWRProvider`.

## `src/repositories/`

Database access only.

## `src/services/`

Business orchestration only.

## `src/types/`

Platform-level shared types such as API response envelopes and status codes.

