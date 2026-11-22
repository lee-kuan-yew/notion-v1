import 'server-only';

export const loginUsername = process.env.PERSONAL_OS_LOGIN_USERNAME?.trim() || 'hello';
export const ownerLoginEmail = process.env.PERSONAL_OS_OWNER_EMAIL?.trim() || 'admin@finanion.app';
