import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CountUp } from '@/components/count-up';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** A headline figure with its label and an optional line of context. */
export function Metric({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  className,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'red' | 'amber' | 'green';
  icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        'lift',
        className,
        tone === 'red' && 'border-red-400',
        tone === 'amber' && 'border-amber-400',
        tone === 'green' && 'border-green-400',
      )}
    >
      <CardContent className="space-y-1 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </div>
          {Icon && (
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg',
                tone === 'red'
                  ? 'bg-red-500/12 text-red-700 dark:text-red-300'
                  : tone === 'amber'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-secondary text-secondary-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
          )}
        </div>
        <div
          className={cn(
            'font-heading text-3xl font-semibold tabular-nums',
            tone === 'red' && 'text-red-700 dark:text-red-300',
            tone === 'amber' && 'text-amber-700 dark:text-amber-300',
          )}
        >
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        {children}
      </CardContent>
    </Card>
  );
}

/** The dark "hero" card of a bento dashboard: one headline figure, big, with room for a bar or list. */
export function HeroMetric({
  label,
  value,
  hint,
  icon: Icon,
  className,
  children,
}: {
  label: string;
  value: number;
  hint?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'animate-rise relative overflow-hidden rounded-2xl bg-gradient-to-br from-[oklch(0.32_0.075_155)] to-[oklch(0.2_0.05_158)] p-6 text-sidebar-foreground shadow-(--shadow-card)',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-sidebar-primary/20 blur-3xl"
      />
      <div className="relative flex h-full flex-col justify-between gap-6">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-sidebar-primary uppercase">
          {Icon && <Icon className="size-4" aria-hidden />} {label}
        </div>
        <div>
          <div className="font-heading text-7xl leading-none font-semibold text-sidebar-accent-foreground">
            <CountUp value={value} />
          </div>
          {hint && <div className="mt-2 text-sm text-sidebar-foreground/80">{hint}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  tone = 'plain',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** plain = white card; soft = pale green wash; accent = saffron wash (bento variation). */
  tone?: 'plain' | 'soft' | 'accent';
}) {
  return (
    <Card
      className={cn(
        tone === 'soft' && 'bg-secondary/60',
        tone === 'accent' && 'bg-accent/70 ring-accent-foreground/10',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="font-heading text-base font-semibold">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

/** PRD §8.1: a ratio with no denominator shows "—", never 0 % or 100 %. */
export function ratio(part: number, whole: number): string {
  return whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`;
}
