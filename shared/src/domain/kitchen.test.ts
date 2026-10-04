import { describe, expect, it } from 'vitest';
import { type PrepUnitInput, prepSummary } from './kitchen';

const GRILL = { id: 'grill', name: 'Grill' };
const CURRY = { id: 'curry', name: 'Curry & Dal' };
const T = (hhmm: string) => `2026-10-05T${hhmm}:00.000Z`;

const unit = (over: Omit<Partial<PrepUnitInput>, 'dish'> & { dish: string }): PrepUnitInput => ({
  stationId: 'grill',
  choices: [],
  quantity: 1,
  plannedKitchenReadyAt: T('06:00'),
  prepStartedAt: null,
  prepDoneAt: null,
  ...over,
  dish: { name: over.dish },
});

describe('FR-KIT-06: prep summary', () => {
  it('totals meals per dish and combination, and what is still left to cook', () => {
    const [grill] = prepSummary(
      [
        unit({ dish: 'Paneer Bowl', choices: ['Brown Rice (Large)'], quantity: 6 }),
        unit({ dish: 'Paneer Bowl', choices: ['Jeera Rice'], quantity: 4, prepDoneAt: T('05:40') }),
        unit({ dish: 'Paneer Bowl', choices: ['Brown Rice (Large)'], quantity: 2 }),
      ],
      [GRILL],
    );
    expect(grill!.dishes).toEqual([
      {
        dishName: 'Paneer Bowl',
        quantity: 12,
        remaining: 8,
        nextDueAt: T('06:00'),
        combinations: [
          { label: 'Brown Rice (Large)', quantity: 8, remaining: 8 },
          { label: 'Jeera Rice', quantity: 4, remaining: 0 },
        ],
      },
    ]);
  });

  it('counts each station’s meals as done, cooking and not started', () => {
    const [grill] = prepSummary(
      [
        unit({ dish: 'A', quantity: 3, prepStartedAt: T('05:00'), prepDoneAt: T('05:20') }),
        unit({ dish: 'A', quantity: 2, prepStartedAt: T('05:30') }),
        unit({ dish: 'B', quantity: 5 }),
      ],
      [GRILL],
    );
    expect(grill!.meals).toEqual({ total: 10, done: 3, cooking: 2, notStarted: 5 });
  });

  it('lists dishes soonest due first and finished dishes last; a dish with no options is "As is"', () => {
    const [grill] = prepSummary(
      [
        unit({ dish: 'Late lunch', quantity: 9, plannedKitchenReadyAt: T('11:00') }),
        unit({ dish: 'Breakfast', quantity: 2, plannedKitchenReadyAt: T('06:00') }),
        unit({ dish: 'Done early', quantity: 20, prepDoneAt: T('05:00') }),
      ],
      [GRILL],
    );
    expect(grill!.dishes.map((d) => d.dishName)).toEqual(['Breakfast', 'Late lunch', 'Done early']);
    expect(grill!.dishes[2]).toMatchObject({ remaining: 0, nextDueAt: null });
    expect(grill!.dishes[0]!.combinations[0]!.label).toBe('As is');
  });

  it('follows the kitchen’s station order, puts "Unassigned" last and skips stations with no work', () => {
    const result = prepSummary(
      [
        unit({ dish: 'Fruit Cup', stationId: null }),
        unit({ dish: 'Dal', stationId: 'curry' }),
        unit({ dish: 'Kebab', stationId: 'grill' }),
      ],
      [CURRY, { id: 'pastry', name: 'Pastry' }, GRILL],
    );
    expect(result.map((s) => s.stationName)).toEqual(['Curry & Dal', 'Grill', 'Unassigned']);
    expect(result[2]!.stationId).toBeNull();
  });
});
