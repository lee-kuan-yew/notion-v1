import { requireOwner } from '@/lib/auth/owner';
import { AppShell } from '@/components/layout/app-shell';
import { WorkspaceProviders } from '@/components/layout/workspace-providers';
import { isLocalMode } from '@/lib/local/mode';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({children}:{children:React.ReactNode}) { await requireOwner(); return <WorkspaceProviders><AppShell localMode={isLocalMode()}>{children}</AppShell></WorkspaceProviders>; }
