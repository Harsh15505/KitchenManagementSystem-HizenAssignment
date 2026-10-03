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
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'red' | 'amber' | 'green';
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        'lift',
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

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
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
