import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** A numbered form step for multi-card forms; the number turns into a tick once it is done. */
export function StepTitle({
  n,
  done = false,
  children,
}: {
  n: number;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <CardTitle className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
          done ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
        )}
      >
        {done ? <Check className="size-3.5" aria-hidden /> : n}
      </span>
      {children}
    </CardTitle>
  );
}
