'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]',
        ghost: 'text-[var(--fg-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
        subtle: 'bg-[var(--surface)] text-[var(--fg-secondary)] border border-[var(--border)] hover:text-[var(--fg)]',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-xs',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium border leading-tight whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--surface-2)] text-[var(--fg-secondary)] border-[var(--border)]',
        ok: 'bg-[var(--ok-soft)] text-[var(--ok)] border-[color-mix(in_oklch,var(--ok)_28%,transparent)]',
        warn: 'bg-[var(--warn-soft)] text-[var(--warn)] border-[color-mix(in_oklch,var(--warn)_28%,transparent)]',
        danger: 'bg-[var(--danger-soft)] text-[var(--danger)] border-[color-mix(in_oklch,var(--danger)_28%,transparent)]',
        info: 'bg-[var(--info-soft)] text-[var(--info)] border-[color-mix(in_oklch,var(--info)_28%,transparent)]',
        accent: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_oklch,var(--accent)_28%,transparent)]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function StatusDot({
  tone = 'neutral',
  pulse = false,
}: {
  tone?: 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
  pulse?: boolean;
}) {
  const colorMap = {
    ok: 'bg-[var(--ok)]',
    warn: 'bg-[var(--warn)]',
    danger: 'bg-[var(--danger)]',
    info: 'bg-[var(--info)]',
    neutral: 'bg-[var(--fg-muted)]',
  };
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0 items-center justify-center">
      {pulse && (
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-45 animate-ping', colorMap[tone])} />
      )}
      <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', colorMap[tone])} />
    </span>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)]',
        className,
      )}
      {...props}
    />
  );
}

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] transition-colors cursor-pointer hover:text-[var(--fg)] data-[state=active]:bg-[var(--surface-2)] data-[state=active]:text-[var(--fg)] data-[state=active]:shadow-xs',
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export function DrawerContent({
  className,
  children,
  title,
  description,
}: {
  className?: string;
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl focus:outline-none',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="truncate font-mono text-sm font-semibold text-[var(--fg)]">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-xs text-[var(--fg-muted)] line-clamp-2">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon" aria-label="关闭抽屉">
              <X className="h-4 w-4" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
