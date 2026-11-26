import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'SkillHub · Local-first AI Agent Skill Console',
  description: 'Local-first AI Agent Skill inventory, security audit gate, Git version diff, repository relations, and telemetry console.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased selection:bg-[var(--info-soft)] selection:text-[var(--fg)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
