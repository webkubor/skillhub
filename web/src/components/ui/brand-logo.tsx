'use client';

import { cn } from '@/lib/utils';

export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      fill="none"
      className={cn('h-7 w-7 shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sh-brand-frame" x1="20" y1="16" x2="108" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--info)" />
          <stop offset="52%" stopColor="var(--ok)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <path
        d="M64 12 109.03 38v52L64 116 18.97 90V38L64 12Z"
        stroke="url(#sh-brand-frame)"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path
        d="M64 29v19M64 80v19M34 46.5l16.5 9.5M77.5 72 94 81.5M94 46.5 77.5 56M50.5 72 34 81.5"
        stroke="url(#sh-brand-frame)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.72"
      />
      <circle cx="64" cy="28" r="5.5" fill="var(--info)" />
      <circle cx="95" cy="46" r="5.5" fill="var(--ok)" />
      <circle cx="95" cy="82" r="5.5" fill="var(--accent)" />
      <circle cx="64" cy="100" r="5.5" fill="var(--ok)" />
      <circle cx="33" cy="82" r="5.5" fill="var(--info)" />
      <circle cx="33" cy="46" r="5.5" fill="var(--accent)" />
      <path d="M64 44 81.32 54v20L64 84 46.68 74V54L64 44Z" fill="url(#sh-brand-frame)" />
      <circle cx="64" cy="64" r="6.5" fill="var(--bg)" />
    </svg>
  );
}
