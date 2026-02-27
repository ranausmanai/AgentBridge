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
          <footer className="border-t border-[var(--border)] mt-16">
            <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row gap-3 md:gap-6 md:items-center md:justify-between text-sm">
              <div className="text-[var(--text-muted)]">
                © {new Date().getFullYear()} AgentBridge
              </div>
              <div className="flex items-center gap-4 text-[var(--text-secondary)]">
                <a href="/" className="hover:text-[var(--text-primary)] transition">Home</a>
                <a href="/privacy" className="hover:text-[var(--text-primary)] transition">Privacy Policy</a>
                <a href="/terms" className="hover:text-[var(--text-primary)] transition">Terms of Service</a>
                <a
                  href="https://discord.gg/UW67PSwF"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--text-primary)] transition"
                >
                  Support Discord
                </a>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
