# Finanion

Private workspace for personal finance and projects. Built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn style components, Supabase Auth/PostgreSQL, RLS, Recharts, TanStack Table, React Hook Form, Zod, dnd-kit and Sonner.

## Current status

The application, schema, RLS, database functions, UI, and automated tests are implemented. When running locally without Supabase credentials, development mode opens the workspace directly and stores real data in an embedded PostgreSQL database. No Supabase project or credentials were present in the starting workspace, so migrations have **not** been applied to a hosted Supabase project. Hosted login and authenticated CRUD still require an isolated Supabase project and owner account.

## Run locally without login

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:3000/app`. With no Supabase environment variables, development mode uses PGlite in `.local-pg/` and creates the profile and default categories on first visit. Accounts, transactions, budgets, projects, tasks, and milestones persist after refresh and server restart. Data stays on this machine and is **not** synchronized to Supabase. The development server binds to `127.0.0.1`; local mode is unavailable in production. Set `PERSONAL_OS_LOCAL_MODE=false` to disable this fallback.

For a populated local example, stop the dev server, run `pnpm seed:local`, then start `pnpm dev` again. The script adds realistic Finance and Projects records to `.local-pg/`, uses fixed IDs, and does not overwrite existing records or touch Supabase. Repeating the command does not duplicate the sample transactions.

## Setup (isolated Supabase project)

1. Create a **new** Supabase project named Finanion. Do not reuse another site's production database.
2. In Supabase Authentication, disable public email signups. Create one user for the owner from the Auth dashboard. Copy that user's UUID.
3. In Project Settings → API, copy the project URL and publishable key. Keep service-role keys out of this repository.
4. Copy `.env.example` to `.env.local` and set:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   PERSONAL_OS_OWNER_USER_ID=YOUR_AUTH_USER_UUID
   SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
   ```

5. Authenticate Supabase CLI (`npx supabase login`), link **only this new project** (`npx supabase link YOUR_PROJECT_REF`), preview with `npx supabase db push --dry-run --remote`, then apply with `npx supabase db push --remote`. Review the linked project before pushing. The migrations only create tables, policies, triggers and functions; they do not seed financial transactions or delete user data.
6. Run `pnpm db:types` after migrations. It writes `src/types/database.generated.ts` without overwriting the checked-in local schema mirror at `src/types/database.ts`. Compare generated types with the mirror when changing the schema.
7. Run `pnpm install` and `pnpm dev`, then open `http://127.0.0.1:3000/login` and sign in with the owner account. The first owner login creates a profile and default categories idempotently.

If some Supabase variables are set but the configuration is incomplete, the application shows a setup message on `/login`.

## Modules

- `/app`: combined financial/project dashboard with period filters, real metrics, charts, deadlines and activity.
- `/app/finance`: finance summary; `/transactions`: CRUD, search, filters, sorting, pagination, project link and CSV export; `/accounts`: balances and history; `/categories`: income/expense hierarchy; `/budgets`: monthly limits; `/reports`: charts.
- `/app/projects`: project CRUD, budget/spending/progress cards; `/app/projects/[id]`: overview, tasks, milestones and linked expenses.
- `/app/tasks`: task CRUD, table and drag-and-drop board with database-persisted ordering.
- `/app/search`: global search; `/app/settings`: owner profile settings.

Transfers move value between accounts and never appear in income or expense totals. Project spending comes only from linked expense transactions. The database prevents cross-owner relationships with composite foreign keys and RLS.

## Quality gates

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:db
pnpm build
pnpm test:e2e
```

`test:db` executes all migrations in PGlite and tests financial rules, parent/child budgets, exact SQL aggregates, month boundaries, ownership and RLS. `test:e2e` always checks the login and protected routes. Its authenticated CRUD test runs only when `PERSONAL_OS_TEST_EMAIL`, `PERSONAL_OS_TEST_PASSWORD`, the Supabase environment variables, and `PERSONAL_OS_OWNER_USER_ID` point to an isolated test project. It writes test records; do not point it at production.

## Deployment

Deploy the Next.js app to a Node-compatible host such as Vercel. Set the same three application environment variables there. Apply migrations to the isolated Supabase project before deploying. Keep public signups disabled and confirm the owner UUID. Use HTTPS. The service-role key is never required by this app. Re-run typecheck, lint, tests and build before release. See `docs/ARCHITECTURE.md`, `docs/DATABASE.md` and `docs/IMPLEMENTATION_PLAN.md` for design decisions and phase gates.

## Scope

Knowledge, Calendar, AI Assistant and automation are future modules. Attachments and CSV import are not part of this MVP. The current list pages load the owner's rows before filtering; this is suitable for a private, modest-sized workspace and should be replaced with database pagination if data volume grows substantially.
