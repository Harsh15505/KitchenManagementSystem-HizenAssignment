'use client';

import type { ReferenceItem } from '@fernleaf/shared';
import { cn } from '@/lib/utils';

/** Toggle chips for picking several reference items (allergens, dietary tags, sizes). */
export function ChipSelect({
  items,
  value,
  onChange,
  disabled,
  label,
}: {
  items: ReferenceItem[] | undefined;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  label: string;
}) {
  const active = (items ?? []).filter((item) => item.isActive || value.includes(item.id));
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {active.map((item) => {
        const on = value.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() =>
              onChange(on ? value.filter((id) => id !== item.id) : [...value, item.id])
            }
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted',
            )}
          >
            {item.name}
          </button>
        );
      })}
      {active.length === 0 && <span className="text-xs text-muted-foreground">None defined</span>}
    </div>
  );
}
