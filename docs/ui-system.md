# UI System

This document describes the UI system used across SST LeaveFlow and where to find related components and tokens.

## Key Concepts

- Design primitives: Tailwind CSS utility classes and shared tokens.
- Component library: `src/components/ui` contains low-level controls (buttons, sheets, toggles).
- Patterns: `src/components/layout` contains layout primitives like `Navbar`, `Sidebar`, and `Container`.

## Where to find components

- `src/components/ui` — shared UI primitives
- `src/components/layout` — app layout components
- `src/components/shared` — small reusable pieces (Logo, StatusBadge, DataTable)

## Theming

Theme state is provided via the `ThemeProvider` in `src/providers/ThemeProvider.tsx` and toggled by `ThemeToggle`.

## Environment & Local Setup

For local development, copy the example env file and fill required values:

```bash
cp .env.example .env.local
```

See the project README for detailed setup steps and the canonical list of environment variables.
