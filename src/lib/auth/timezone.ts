import 'server-only';
import { cookies } from 'next/headers';

const TIMEZONE_COOKIE = 'finanion-timezone';
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function normalizeTimezone(value: string | null | undefined) {
  if (!value || value.length > 80) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export async function readTimezone() {
  return normalizeTimezone((await cookies()).get(TIMEZONE_COOKIE)?.value);
}

export async function writeTimezone(value: string) {
  (await cookies()).set(TIMEZONE_COOKIE, normalizeTimezone(value), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearTimezone() {
  (await cookies()).delete(TIMEZONE_COOKIE);
}
