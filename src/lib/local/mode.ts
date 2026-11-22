// Enabled only for an unconfigured development checkout. Production never uses local mode.
export function isLocalMode() {
  return process.env.NODE_ENV === 'development'
    && process.env.PERSONAL_OS_LOCAL_MODE !== 'false'
    && !process.env.NEXT_PUBLIC_SUPABASE_URL
    && !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    && !process.env.PERSONAL_OS_OWNER_USER_ID;
}
export const LOCAL_OWNER_ID = '11111111-1111-4111-8111-111111111111';
