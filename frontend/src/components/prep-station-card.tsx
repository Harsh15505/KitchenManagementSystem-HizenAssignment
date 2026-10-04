import type { PrepStation } from '@fernleaf/shared';
import { Check, ChefHat, Clock } from 'lucide-react';
import {
  Chip,
  ListBox,
  ListBoxEmpty,
  ListBoxFooter,
  ListBoxHeader,
  ListBoxRow,
  ListBoxRows,
  QtyPill,
} from '@/components/list-box';
import { Badge } from '@/components/ui/badge';
import { formatIst } from '@/lib/orders';
import { plural } from '@/lib/utils';

/**
 * FR-KIT-06: one station of the prep summary. Each dish still to cook is a row: meals left in the
 * lead column, its combinations as framed chips, and its ready-by time (red once it has passed).
 * Finished dishes fold into the footer. Shared by the kitchen dashboard and the board's prep view.
 */
export function PrepStationCard({ station: s, now }: { station: PrepStation; now: string }) {
  const left = s.meals.total - s.meals.done;
  const open = s.dishes.filter((d) => d.remaining > 0);
  const done = s.dishes.filter((d) => d.remaining === 0);
  const unassigned = s.stationId === null;
  const pct = (n: number) => (s.meals.total === 0 ? 0 : (n / s.meals.total) * 100);

  return (
    <ListBox tone={unassigned ? 'warning' : 'default'}>
      <ListBoxHeader
        icon={ChefHat}
        tone={unassigned ? 'warning' : 'default'}
        title={s.stationName}
        meta={
          <>
            <Badge variant={left === 0 ? 'success' : 'secondary'}>
              {left === 0 ? 'All done' : `${left} left`}
            </Badge>
            <span className="text-muted-foreground tabular-nums">
              {plural(s.meals.total, 'meal')}
            </span>
          </>
        }
      />
      <div
        className="flex h-1.5 bg-muted"
        role="img"
        aria-label={`${s.meals.done} done, ${s.meals.cooking} cooking, ${s.meals.notStarted} not started`}
      >
        <span className="h-full bg-primary" style={{ width: `${pct(s.meals.done)}%` }} />
        <span className="h-full bg-chart-2" style={{ width: `${pct(s.meals.cooking)}%` }} />
      </div>
      {open.length === 0 ? (
        <ListBoxEmpty>Everything at this station is cooked.</ListBoxEmpty>
      ) : (
        <ListBoxRows>
          {open.map((d) => {
            const late = d.nextDueAt !== null && d.nextDueAt < now;
            return (
              <ListBoxRow
                key={d.dishName}
                lead={<QtyPill value={d.remaining} />}
                title={
                  <>
                    {d.dishName}
                    {d.remaining < d.quantity && (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        · {d.quantity - d.remaining} of {d.quantity} done
                      </span>
                    )}
                  </>
                }
                sub={
                  <span className="flex flex-wrap gap-1">
                    {d.combinations
                      .filter((c) => c.remaining > 0)
                      .map((c) => (
                        <Chip key={c.label} count={c.remaining}>
                          {c.label}
                        </Chip>
                      ))}
                  </span>
                }
                trail={
                  <Badge variant={late ? 'destructive' : 'outline'}>
                    <Clock aria-hidden />
                    {late ? 'late · ' : 'by '}
                    {formatIst(d.nextDueAt!)}
                  </Badge>
                }
              />
            );
          })}
        </ListBoxRows>
      )}
      {done.length > 0 && (
        <ListBoxFooter className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            <Check className="size-3.5" aria-hidden /> Done
          </span>
          {done.map((d) => (
            <span key={d.dishName}>
              <span className="font-medium text-foreground tabular-nums">{d.quantity}×</span>{' '}
              {d.dishName}
            </span>
          ))}
        </ListBoxFooter>
      )}
    </ListBox>
  );
}
