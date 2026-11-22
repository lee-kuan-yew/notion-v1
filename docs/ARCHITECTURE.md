# Finanion architecture

## Audit, 2026-11-22
The starting workspace contains only an empty `!.html` and is not a Git repository. There is no app, package lock, configuration, tests, database, or user code to migrate. Lipi is a WIP Notion clone with collaboration and a different persistence stack; it is a visual reference only. A clean Next.js App Router project avoids inheriting unrelated collaboration code and experimental dependencies.

## System
One private owner account signs in with Supabase Auth. Next.js server components read data through a typed data access layer; server actions validate input with Zod and mutate via the user's cookie scoped Supabase client. Route protection and every mutation verify the owner. PostgreSQL RLS is the final ownership boundary. The publishable key is the only key used by the app.

An unconfigured `next dev` checkout uses a local PGlite database with the same migrations and SQL functions. The local data is persisted under `.local-pg/`, stays on the machine, and is not synced to Supabase. This mode bypasses login only in development on a loopback host. Production always requires Supabase Auth and the configured owner ID.

Finance owns accounts, categories, transactions, and monthly budgets. Projects owns projects, tasks, and milestones. An expense can reference a project; project spending is derived from those transactions. Financial aggregates and balances are calculated in PostgreSQL with NUMERIC, never stored as mutable totals.

The application is split into foundation, Finance, Projects, integration, and polish. Knowledge, Calendar, Intelligence, and AI are future modules. No block editor or duplicated expense ledger is included in the MVP.
