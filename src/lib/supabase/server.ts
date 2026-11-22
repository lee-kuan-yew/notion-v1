import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { isLocalMode } from '@/lib/local/mode';

export async function createClient() {
  if (isLocalMode()) {
    const { createLocalClient } = await import('@/lib/local/client');
    return createLocalClient() as unknown as SupabaseClient<Database>;
  }
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_FINANION_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_FINANION_SUPABASE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured. See README.md.');
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items) { try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Component: proxy refreshes cookies */ } },
    },
  });
}
