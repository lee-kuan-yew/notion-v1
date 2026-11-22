import { signIn } from './actions';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { isLocalMode } from '@/lib/local/mode';
import { loginUsername, ownerLoginEmail } from '@/lib/auth/login-config';

const dashV = 'absolute inset-y-[-48px] w-px border-l border-dashed border-stone-400/60';
const dashH = 'absolute inset-x-[-48px] h-px border-t border-dashed border-stone-400/60';
const inputCls = 'h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-base text-stone-900 shadow-sm outline-none placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-300/60';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (isLocalMode()) redirect('/app');
  const { error } = await searchParams;
  const configured = !!process.env.NEXT_PUBLIC_FINANION_SUPABASE_URL && !!process.env.NEXT_PUBLIC_FINANION_SUPABASE_KEY && !!process.env.PERSONAL_OS_OWNER_USER_ID && !!ownerLoginEmail;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f5f5] p-5">
      <div className="relative w-full max-w-[460px] py-12">
        <span aria-hidden className={`${dashV} left-0`} />
        <span aria-hidden className={`${dashV} right-0`} />
        <span aria-hidden className={`${dashH} top-0`} />
        <span aria-hidden className={`${dashH} bottom-0`} />
        <div className="relative px-6 sm:px-8">
          <div className="mb-8 flex items-center justify-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-black">
              <Image src="/logo.png" alt="" width={32} height={32} className="size-8 invert" priority />
            </span>
            <h1 className="text-[28px] font-semibold tracking-tight text-stone-900">Finanion</h1>
          </div>
          {!configured && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-800">Chưa cấu hình Supabase hoặc owner. Xem README.md để bắt đầu.</p>}
          {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
          <form action={signIn} className="grid gap-5">
            <div className="grid gap-2">
              <label htmlFor="username" className="text-base font-medium text-stone-700">Username</label>
              <input id="username" name="username" type="text" required placeholder={loginUsername} autoComplete="username" className={inputCls} />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password" className="text-base font-medium text-stone-700">Mật khẩu</label>
              <input id="password" name="password" type="password" required placeholder="••••••••" autoComplete="current-password" className={inputCls} />
            </div>
            <button disabled={!configured} className="mt-1 h-14 w-full rounded-2xl bg-gradient-to-b from-stone-700 to-black text-lg font-semibold text-white shadow-lg shadow-black/25 transition hover:from-stone-600 disabled:opacity-50">
              Đăng nhập
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
