import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import './globals.css';
export const metadata: Metadata = { title: 'Personal OS', description: 'Your private operating system' };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="vi" suppressHydrationWarning><body><ThemeProvider attribute="class" defaultTheme="system" enableSystem><Toaster richColors position="top-right" />{children}</ThemeProvider></body></html>;
}
