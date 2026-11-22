import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isLocalMode, LOCAL_OWNER_ID } from '@/lib/local/mode';
export const requireOwner = cache(async function requireOwner() {
  if (isLocalMode()) {
    const host = (await headers()).get('host') ?? '';
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) throw new Error('Local mode is available only on this machine.');
    return { supabase: await createClient(), user: { id: LOCAL_OWNER_ID, email: 'local@personal.os' } };
  }
  const ownerId = process.env.PERSONAL_OS_OWNER_USER_ID;
  if (!ownerId || !process.env.NEXT_PUBLIC_FINANION_SUPABASE_URL || !process.env.NEXT_PUBLIC_FINANION_SUPABASE_KEY) redirect('/login');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || claims.sub !== ownerId) redirect('/login');
  const user = { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined };
  return { supabase, user };
});
