import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/nav';

export const metadata: Metadata = {
  title: 'AgentBridge — Make Any API Agent-Ready',
  description: 'The central hub for agent-ready APIs. Register your API, and let AI agents interact with it using natural language.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
