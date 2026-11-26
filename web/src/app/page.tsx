import { Suspense } from 'react';
import { Dashboard } from '@/components/dashboard';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-xs text-[var(--fg-muted)]">
          Loading SkillHub…
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
