import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_FINANION_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_FINANION_SUPABASE_KEY;
  if (!url || !key) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims();
  if (request.nextUrl.pathname.startsWith('/app') && (error || !data?.claims || data.claims.sub !== process.env.PERSONAL_OS_OWNER_USER_ID)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return response;
}
export const config = { matcher: ['/app/:path*', '/login'] };
