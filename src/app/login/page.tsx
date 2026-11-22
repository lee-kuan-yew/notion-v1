import { signIn } from './actions';
import { redirect } from 'next/navigation';
import { isLocalMode } from '@/lib/local/mode';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) {
  if (isLocalMode()) redirect('/app');
  const {error}=await searchParams;
  const configured=!!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !!process.env.PERSONAL_OS_OWNER_USER_ID;
  return <main className="min-h-screen grid place-items-center p-5"><div className="w-full max-w-sm"><div className="mb-8"><img src="/logo.png" alt="" className="mb-3 size-12 dark:invert" /><h1 className="text-3xl font-semibold tracking-tight">Finanion</h1><p className="mt-2 text-muted">Không gian riêng cho tài chính và dự án.</p></div><div className="card p-6"><h2 className="text-lg font-semibold mb-5">Đăng nhập</h2>{!configured && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-800">Chưa cấu hình Supabase hoặc owner. Xem README.md để bắt đầu.</p>}{error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}<form action={signIn} className="grid gap-4"><div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" autoComplete="email" /></div><div className="field"><label htmlFor="password">Mật khẩu</label><input id="password" name="password" type="password" required className="input" autoComplete="current-password" /></div><button className="btn btn-primary mt-2" disabled={!configured}>Vào workspace</button></form></div><p className="meta mt-4">Chỉ tài khoản owner đã cấu hình mới có quyền truy cập.</p></div></main>;
}
