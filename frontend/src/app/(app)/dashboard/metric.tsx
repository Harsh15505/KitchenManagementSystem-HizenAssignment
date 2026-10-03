import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** A headline figure with its label and an optional line of context. */
export function Metric({
  label,
  value,
  hint,
  tone,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'red' | 'amber' | 'green';
  children?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        tone === 'red' && 'border-red-400',
        tone === 'amber' && 'border-amber-400',
        tone === 'green' && 'border-green-400',
      )}
    >
      <CardContent className="space-y-1 pt-5">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
        <div
          className={cn(
            'text-2xl font-semibold tabular-nums',
            tone === 'red' && 'text-red-700 dark:text-red-300',
            tone === 'amber' && 'text-amber-700 dark:text-amber-300',
          )}
        >
          {value}
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
        <CardTitle className="text-base">{title}</CardTitle>
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
