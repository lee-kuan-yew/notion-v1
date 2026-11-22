# Implementation plan and gates

## Phase 0 — Foundation
Completed locally: clean Next.js project, Supabase cookie Auth, owner guard, protected layout, migration SQL, RLS, typed schema mirror and design system. An unconfigured development checkout now opens a persistent PGlite workspace on loopback without login. Embedded PostgreSQL migration tests pass. Hosted Supabase application and live login are pending credentials and a new isolated project.

## Phase 1 — Finance and Projects
Completed locally: account/category/transaction/budget CRUD, reports, project/task/milestone CRUD, project detail and task board. Zod validates server mutations; Postgres validates relationship and financial rules. SQL integration tests pass. Authenticated browser CRUD test is defined but awaits the isolated Supabase project.

## Phase 2 — Integration
Completed locally: linked expenses, SQL project spending, budget utilization, combined dashboard, global search and CSV export. Database tests confirm expense edit/delete updates project spending and transfers do not affect income/expense. Authenticated dashboard behavior awaits live integration testing.

## Phase 3 — Polish and Release
Completed locally: responsive layout, dark mode, empty/loading/error states, unit tests, SQL tests, Playwright unauthenticated tests, lint and production build. Accessibility and authenticated browser flows need a final pass against the connected Supabase project.

A phase's **live acceptance** cannot be marked complete before the isolated project is configured, migrations are applied, and the authenticated CRUD suite runs there. No production database should be used for this gate.
