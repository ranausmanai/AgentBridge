import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/nav';
import ThemeProvider from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'AgentBridge — Make Any API Agent-Ready',
  description: 'The central hub for agent-ready APIs. Register your API, and let AI agents interact with it using natural language.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-[var(--bg)] text-[var(--text-primary)] min-h-screen">
        <ThemeProvider>
          <Nav />
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
