import 'server-only';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCAL_OWNER_ID } from './mode';

declare global {
  var personalOsLocalDb: Promise<PGlite> | undefined;
}

async function initialize() {
  const root = process.cwd();
  const db = await PGlite.create(join(root, '.local-pg'));
  const existing = await db.query<{ name: string | null }>("select to_regclass('public.profiles')::text as name");
  if (!existing.rows[0]?.name) {
    await db.exec(`create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create role authenticated;
      create role anon;`);
    await db.query('insert into auth.users(id) values ($1)', [LOCAL_OWNER_ID]);
  }
  const migrationDir = join(root, 'supabase', 'migrations');
  const files = readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort();
  await db.exec('create table if not exists public.schema_migrations (filename text primary key, applied_at timestamptz not null default now())');
  if (existing.rows[0]?.name) {
    for (const file of files.filter(name => name < '20261122000004_database_engine.sql')) {
      await db.query('insert into public.schema_migrations(filename) values ($1) on conflict do nothing', [file]);
    }
  }
  for (const file of files) {
    const applied = await db.query('select 1 from public.schema_migrations where filename=$1', [file]);
    if (applied.rows.length) continue;
    await db.exec('begin');
    try {
      await db.exec(readFileSync(join(migrationDir, file), 'utf8'));
      await db.query('insert into public.schema_migrations(filename) values ($1)', [file]);
      await db.exec('commit');
    } catch (error) {
      await db.exec('rollback');
      throw error;
    }
  }
  await db.exec('grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; set role authenticated');
  await db.query('select set_config($1,$2,false)', ['request.jwt.claim.sub', LOCAL_OWNER_ID]);
  return db;
}

export function getLocalDb() {
  globalThis.personalOsLocalDb ??= initialize().catch(error => {
    globalThis.personalOsLocalDb = undefined;
    throw error;
  });
  return globalThis.personalOsLocalDb;
}
