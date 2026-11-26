import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatShortTime(iso: string): string {
  if (!iso) return '—';
  const normalized = iso.replace('T', ' ').slice(0, 16);
  return normalized;
}
