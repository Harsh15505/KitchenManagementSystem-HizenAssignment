/**
 * FR-KIT-06: the prep summary a kitchen lead reads at 6 am. Pure: the API passes the day's prep
 * units (Confirmed and Delivered orders, without "do not cook") and its stations in kitchen order.
 */

/** The fields of a prep unit the summary needs (a `KitchenUnitDto` satisfies it). */
export interface PrepUnitInput {
  stationId: string | null;
  dish: { name: string };
  /** "Paneer", "Brown Rice (Large)"… in menu order; empty = the dish as is. */
  choices: string[];
  quantity: number;
  plannedKitchenReadyAt: string;
  prepStartedAt: string | null;
  prepDoneAt: string | null;
}

export interface PrepStation {
  stationId: string | null;
  stationName: string;
  /** Meals by state; total = done + cooking + notStarted. */
  meals: { total: number; done: number; cooking: number; notStarted: number };
  dishes: Array<{
    dishName: string;
    /** Every meal of this dish for the day, cooked or not. */
    quantity: number;
    /** Meals not marked done yet. */
    remaining: number;
    /** Earliest planned kitchen-ready among the meals still to cook; null once all are done. */
    nextDueAt: string | null;
    combinations: Array<{ label: string; quantity: number; remaining: number }>;
  }>;
}

export const UNASSIGNED_STATION = 'Unassigned';

/**
 * Stations follow the kitchen's own order with "Unassigned" (dishes without a station) last, and
 * only stations with work appear. Within a station, dishes still to cook come first, soonest due
 * first (ties: more meals first); finished dishes sink to the bottom. Combinations are ordered by
 * quantity. A combination label is its choices joined with ", " or "As is".
 */
export function prepSummary(
  units: readonly PrepUnitInput[],
  stations: ReadonlyArray<{ id: string; name: string }>,
): PrepStation[] {
  type Dish = PrepStation['dishes'][number] & { combos: Map<string, { q: number; r: number }> };
  const byStation = new Map<
    string | null,
    { meals: PrepStation['meals']; dishes: Map<string, Dish> }
  >();

  for (const u of units) {
    const station = byStation.get(u.stationId) ?? {
      meals: { total: 0, done: 0, cooking: 0, notStarted: 0 },
      dishes: new Map<string, Dish>(),
    };
    station.meals.total += u.quantity;
    if (u.prepDoneAt) station.meals.done += u.quantity;
    else if (u.prepStartedAt) station.meals.cooking += u.quantity;
    else station.meals.notStarted += u.quantity;

    const dish: Dish = station.dishes.get(u.dish.name) ?? {
      dishName: u.dish.name,
      quantity: 0,
      remaining: 0,
      nextDueAt: null,
      combinations: [],
      combos: new Map(),
    };
    dish.quantity += u.quantity;
    const label = u.choices.join(', ') || 'As is';
    const combo = dish.combos.get(label) ?? { q: 0, r: 0 };
    combo.q += u.quantity;
    if (!u.prepDoneAt) {
      dish.remaining += u.quantity;
      combo.r += u.quantity;
      if (dish.nextDueAt === null || u.plannedKitchenReadyAt < dish.nextDueAt)
        dish.nextDueAt = u.plannedKitchenReadyAt;
    }
    dish.combos.set(label, combo);
    station.dishes.set(u.dish.name, dish);
    byStation.set(u.stationId, station);
  }

  const order = [
    ...stations.map((s) => ({ id: s.id as string | null, name: s.name })),
    { id: null, name: UNASSIGNED_STATION },
  ];
  return order.flatMap((s) => {
    const station = byStation.get(s.id);
    if (!station) return [];
    const dishes = [...station.dishes.values()]
      .sort(
        (a, b) =>
          Number(a.remaining === 0) - Number(b.remaining === 0) ||
          (a.nextDueAt ?? '').localeCompare(b.nextDueAt ?? '') ||
          b.quantity - a.quantity ||
          a.dishName.localeCompare(b.dishName),
      )
      .map(({ combos, ...dish }) => ({
        ...dish,
        combinations: [...combos.entries()]
          .sort((a, b) => b[1].q - a[1].q || a[0].localeCompare(b[0]))
          .map(([label, c]) => ({ label, quantity: c.q, remaining: c.r })),
      }));
    return [{ stationId: s.id, stationName: s.name, meals: station.meals, dishes }];
  });
}
