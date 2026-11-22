'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isLocalMode } from '@/lib/local/mode';
import { loginUsername, ownerLoginEmail } from '@/lib/auth/login-config';
export async function signIn(form: FormData) {
  if (isLocalMode()) redirect('/app');
  const username=String(form.get('username')??'').trim();
  const password=String(form.get('password')??'');
  if(!username || !password) redirect('/login?error=Vui+lòng+nhập+username+và+mật+khẩu');
  if(username !== loginUsername) redirect('/login?error=Thông+tin+đăng+nhập+không+đúng');
  const supabase=await createClient();
  const {data,error}=await supabase.auth.signInWithPassword({email:ownerLoginEmail,password});
  if(error || !data.user) redirect('/login?error=Thông+tin+đăng+nhập+không+đúng');
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
