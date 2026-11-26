'use client';

import { cn } from '@/lib/utils';

export interface AgentMeta {
  id: string;
  label: string;
  toneClass: string;
  dotColor: string;
}

function normalizeAgent(raw: string): string {
  const s = (raw || '').toLowerCase().trim();
  if (s.includes('claude')) return 'claude';
  if (s.includes('codex') || s.includes('openai')) return 'codex';
  if (s.includes('gemini') || s.includes('agy') || s.includes('antigravity')) return 'gemini';
  if (s.includes('cursor')) return 'cursor';
  if (s.includes('dsh') || s.includes('deepseek')) return 'dsh';
  if (s.includes('opencode')) return 'opencode';
  if (s.includes('hermes')) return 'hermes';
  if (s.includes('agent')) return 'agents';
  return 'custom';
}

export function getAgentMeta(raw: string): AgentMeta {
  const key = normalizeAgent(raw);
  switch (key) {
    case 'claude':
      return {
        id: 'claude',
        label: raw || 'Claude',
        toneClass: 'bg-[var(--warn-soft)] text-[var(--warn)] border-[color-mix(in_oklch,var(--warn)_30%,transparent)]',
        dotColor: 'var(--warn)',
      };
    case 'codex':
      return {
        id: 'codex',
        label: raw || 'Codex',
        toneClass: 'bg-[var(--ok-soft)] text-[var(--ok)] border-[color-mix(in_oklch,var(--ok)_30%,transparent)]',
        dotColor: 'var(--ok)',
      };
    case 'gemini':
      return {
        id: 'gemini',
        label: raw || 'Gemini',
        toneClass: 'bg-[var(--info-soft)] text-[var(--info)] border-[color-mix(in_oklch,var(--info)_30%,transparent)]',
        dotColor: 'var(--info)',
      };
    case 'cursor':
      return {
        id: 'cursor',
        label: raw || 'Cursor',
        toneClass: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_oklch,var(--accent)_30%,transparent)]',
        dotColor: 'var(--accent)',
      };
    case 'dsh':
      return {
        id: 'dsh',
        label: raw || 'DSH',
        toneClass: 'bg-[var(--info-soft)] text-[var(--info)] border-[color-mix(in_oklch,var(--info)_30%,transparent)]',
        dotColor: 'var(--info)',
      };
    case 'opencode':
      return {
        id: 'opencode',
        label: raw || 'OpenCode',
        toneClass: 'bg-[var(--surface-2)] text-[var(--fg-secondary)] border-[var(--border-strong)]',
        dotColor: 'var(--fg-secondary)',
      };
    case 'hermes':
      return {
        id: 'hermes',
        label: raw || 'Hermes',
        toneClass: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_oklch,var(--accent)_30%,transparent)]',
        dotColor: 'var(--accent)',
      };
    default:
      return {
        id: key,
        label: raw || 'Agent',
        toneClass: 'bg-[var(--surface-2)] text-[var(--fg-secondary)] border-[var(--border)]',
        dotColor: 'var(--fg-muted)',
      };
  }
}

export function AgentIcon({ agent, className }: { agent: string; className?: string }) {
  const key = normalizeAgent(agent);
  const common = cn('h-3.5 w-3.5 shrink-0', className);

  switch (key) {
    case 'claude':
      // 8-ray editorial sun/spark
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <path
            d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'codex':
      // Hexagonal node
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <path
            d="M8 1.75 13.4 4.88v6.24L8 14.25 2.6 11.12V4.88L8 1.75Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </svg>
      );
    case 'gemini':
      // 4-point star
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <path
            d="M8 1.5C8.5 5.2 10.8 7.5 14.5 8c-3.7.5-6 2.8-6.5 6.5-.5-3.7-2.8-6-6.5-6.5C5.2 7.5 7.5 5.2 8 1.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'cursor':
      // Precision cursor cube
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <path
            d="M3 2.5 13 7.5 8.5 9.2 6.8 13.5 3 2.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'dsh':
      // Terminal prompt diamond
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <rect x="2" y="2.5" width="12" height="11" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="m5 6.5 2 1.75L5 10M8.5 10h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'opencode':
      // Code brackets
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <path d="M5.5 4.2 2.2 8l3.3 3.8M10.5 4.2 13.8 8l-3.3 3.8M9 3.5l-2 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'hermes':
      // Speed wing / chevron
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <path d="M2.5 11.5 7.5 4.5h6L8.5 11.5h-6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    default:
      // Generic geometric agent chip
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <rect x="3" y="4" width="10" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="6.2" cy="8.2" r="1" fill="currentColor" />
          <circle cx="9.8" cy="8.2" r="1" fill="currentColor" />
          <path d="M8 2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
  }
}

export function AgentBadge({
  agent,
  count,
  compact = false,
  className,
}: {
  agent: string;
  count?: number;
  compact?: boolean;
  className?: string;
}) {
  const meta = getAgentMeta(agent);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-mono leading-none whitespace-nowrap',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
        meta.toneClass,
        className,
      )}
    >
      <AgentIcon agent={agent} className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span>{meta.label}</span>
      {typeof count === 'number' && (
        <span className="tabular-nums opacity-75">{count}</span>
      )}
    </span>
  );
}

export function detectRuntimeAgents(scannedRoots: string[]): string[] {
  const found = new Set<string>();
  for (const r of scannedRoots) {
    const low = r.toLowerCase();
    if (low.includes('.claude')) found.add('claude');
    if (low.includes('.codex')) found.add('codex');
    if (low.includes('.gemini')) found.add('gemini');
    if (low.includes('.cursor')) found.add('cursor');
    if (low.includes('.dsh')) found.add('dsh');
    if (low.includes('opencode')) found.add('opencode');
    if (low.includes('.agents')) found.add('agents');
  }
  return [...found];
}
