'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isLocalMode } from '@/lib/local/mode';
export async function signIn(form: FormData) {
  if (isLocalMode()) redirect('/app');
  const email=String(form.get('email')??'').trim();
  const password=String(form.get('password')??'');
  if(!email || !password) redirect('/login?error=Email+and+password+required');
  const supabase=await createClient();
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error || !data.user) redirect(`/login?error=${encodeURIComponent((error?.message??'Sign in failed')+' | '+(process.env.NEXT_PUBLIC_SUPABASE_URL||'').slice(8,30)+' | '+(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').slice(0,18)+' | pw'+password.length)}`);
  if(data.user.id !== process.env.PERSONAL_OS_OWNER_USER_ID) {
    await supabase.auth.signOut();
    redirect('/login?error=This+account+is+not+the+configured+owner');
  }
  redirect('/app');
}
export async function signOut() {
  if (isLocalMode()) redirect('/app');
  const supabase=await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
