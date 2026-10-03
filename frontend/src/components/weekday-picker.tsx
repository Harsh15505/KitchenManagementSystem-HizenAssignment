'use client';

import { cn } from '@/lib/utils';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** "Mon–Fri", "Tue–Thu", "Every day", or a list such as "Mon, Wed, Fri". ISO weekdays 1..7. */
export function describeDays(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (contiguous && sorted.length > 2)
    return `${WEEKDAYS[sorted[0]! - 1]}–${WEEKDAYS[sorted.at(-1)! - 1]}`;
  return sorted.map((d) => WEEKDAYS[d - 1]).join(', ');
}

/** Toggle buttons for ISO weekdays (1 = Monday). */
export function WeekdayPicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {WEEKDAYS.map((name, index) => {
        const day = index + 1;
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day].sort())}
            className={cn(
              'h-9 w-12 rounded-md border text-sm',
              on ? 'bg-primary text-primary-foreground' : 'bg-background',
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
