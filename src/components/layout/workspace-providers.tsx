'use client';

import { ThemeProvider } from '@/components/layout/theme-provider';
import { Toaster } from 'sonner';

export function WorkspaceProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system">
      <Toaster richColors position="top-right" />
      {children}
    </ThemeProvider>
  );
}
