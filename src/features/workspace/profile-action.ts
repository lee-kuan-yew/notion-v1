'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { writeTimezone } from '@/lib/auth/timezone';

function isValidTimezone(tz: string): boolean {
  if (!tz || tz.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function saveProfile(form: FormData) {
  const nameResult = z.string().trim().max(120).safeParse(String(form.get('display_name') ?? ''));
  if (!nameResult.success) redirect('/app/settings?error=Invalid+name');

  const rawTimezone = String(form.get('timezone') ?? '').trim();
  const timezone = isValidTimezone(rawTimezone) ? rawTimezone : 'Asia/Ho_Chi_Minh';

  const { supabase, user } = await requireOwner();
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: nameResult.data, timezone })
    .eq('id', user.id)
    .eq('user_id', user.id);
  if (error) redirect(`/app/settings?error=${encodeURIComponent(error.message)}`);
  await writeTimezone(timezone);
  revalidatePath('/app', 'layout');
  redirect('/app/settings?saved=1');
}
