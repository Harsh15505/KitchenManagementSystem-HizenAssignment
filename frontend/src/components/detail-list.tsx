import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Label/value facts inside a card: an icon and a small label on the left, the value on the right,
 * with dividers, so text never floats in empty space. Stacks under 480 px.
 */
export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('divide-y divide-border/70 text-sm', className)}>{children}</dl>;
}

export function DetailRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between min-[480px]:gap-4',
        className,
      )}
    >
      <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
        {Icon && (
          <span className="flex size-6 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Icon className="size-3.5" aria-hidden />
          </span>
        )}
        {label}
      </dt>
      <dd className="min-w-0 font-medium min-[480px]:text-right">{children}</dd>
    </div>
  );
}
