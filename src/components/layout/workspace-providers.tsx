'use client';

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

export function WorkspaceProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Toaster richColors position="top-right" />
      {children}
    </ThemeProvider>
  );
}
