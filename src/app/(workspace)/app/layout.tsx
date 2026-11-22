import { requireOwner } from '@/lib/auth/owner';
import { AppShell } from '@/components/layout/app-shell';
import { isLocalMode } from '@/lib/local/mode';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({children}:{children:React.ReactNode}) { await requireOwner(); return <AppShell localMode={isLocalMode()}>{children}</AppShell>; }
