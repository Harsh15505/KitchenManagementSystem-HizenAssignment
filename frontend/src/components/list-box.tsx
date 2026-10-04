import { CheckCircle2, ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A framed list, so text never floats on an empty card: a tinted header band (title + counts),
 * rows on a fixed grid (lead · main · trailing value) separated by dividers, and an optional
 * footer band. Used for prep summaries, setup gaps, option groups, order lines and the like.
 */
export function ListBox({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: 'default' | 'warning' | 'danger';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card',
        tone === 'warning' && 'border-amber-300 dark:border-amber-900',
        tone === 'danger' && 'border-red-300 dark:border-red-900',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListBoxHeader({
  icon: Icon,
  title,
  meta,
  tone = 'default',
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  meta?: ReactNode;
  tone?: 'default' | 'warning' | 'danger';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b px-3 py-2',
        tone === 'default' && 'bg-muted/60',
        tone === 'warning' && 'bg-amber-500/10',
        tone === 'danger' && 'bg-red-500/10',
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md bg-card shadow-xs ring-1 ring-foreground/5',
            tone === 'warning' && 'text-amber-700 dark:text-amber-300',
            tone === 'danger' && 'text-red-700 dark:text-red-300',
            tone === 'default' && 'text-muted-foreground',
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
      {meta && <span className="flex shrink-0 items-center gap-1.5 text-xs">{meta}</span>}
    </div>
  );
}

export function ListBoxRows({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('divide-y divide-border/70', className)}>{children}</ul>;
}

/**
 * One row: an optional lead column (a quantity pill, a checkbox, an icon), the main text with an
 * optional second line, and a right-aligned trailing value. With `href` the whole row is a link.
 */
export function ListBoxRow({
  lead,
  title,
  sub,
  trail,
  href,
  muted = false,
  className,
}: {
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trail?: ReactNode;
  href?: string;
  muted?: boolean;
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-2',
        href && 'transition-colors hover:bg-muted/50',
        muted && 'opacity-60',
        className,
      )}
    >
      {lead !== undefined && <div className="shrink-0">{lead}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug font-medium">{title}</div>
        {sub !== undefined && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </div>
      {(trail !== undefined || href) && (
        <div className="flex shrink-0 items-center gap-1 self-center text-right text-xs">
          {trail}
          {href && <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
        </div>
      )}
    </div>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="block focus-visible:bg-muted/50 focus-visible:outline-none">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

/** The calm "nothing here" row: a tick and a short sentence, inside the frame. */
export function ListBoxEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
      <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
      {children}
    </div>
  );
}

export function ListBoxFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('border-t bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground', className)}
    >
      {children}
    </div>
  );
}

/** A contained number for the lead column: a quantity or a count. */
export function QtyPill({
  value,
  tone = 'default',
}: {
  value: ReactNode;
  tone?: 'default' | 'done';
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-9 items-center justify-center rounded-md px-1.5 font-heading text-sm font-semibold tabular-nums',
        tone === 'default' && 'bg-secondary text-secondary-foreground',
        tone === 'done' && 'bg-muted text-muted-foreground',
      )}
    >
      {value}
    </span>
  );
}

/** A small framed tag for a combination or option inside a row ("3 × Brown Rice (Large)"). */
export function Chip({
  count,
  children,
  tone = 'default',
}: {
  count?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-0.5 text-xs',
        tone === 'danger' && 'border-red-300 text-red-700 dark:border-red-900 dark:text-red-300',
      )}
    >
      {count !== undefined && (
        <span className="font-semibold text-foreground tabular-nums">{count}×</span>
      )}
      <span>{children}</span>
    </span>
  );
}
