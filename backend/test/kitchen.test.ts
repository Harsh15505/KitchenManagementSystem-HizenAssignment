import { describe, expect, it } from 'vitest';
import type { CurrentUserInfo } from '../src/authz/current-user';
import type { ClockService } from '../src/clock/clock.service';
import { DomainError } from '../src/common/domain-error';
import { KitchenService } from '../src/kitchen/kitchen.service';
import type { PlanningService } from '../src/orders/planning.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const NOW = new Date('2026-10-05T05:00:00.000Z');
const actor = { id: 'cook', name: 'Vikram Nair' } as CurrentUserInfo;

interface Unit {
  id: string;
  orderId: string;
  prepStartedAt: Date | null;
  prepDoneAt: Date | null;
}

/** In-memory double covering exactly the calls KitchenService makes inside its transactions. */
function world(status: string, unitCount = 2) {
  const order = {
    id: 'o1',
    status,
    kitchenStartedAt: null as Date | null,
    kitchenReadyAt: null as Date | null,
    demoAutopilotUntil: 'DELIVERED' as string | null,
  };
  const units: Unit[] = Array.from({ length: unitCount }, (_, i) => ({
    id: `u${i + 1}`,
    orderId: 'o1',
    prepStartedAt: null,
    prepDoneAt: null,
  }));
  const events: string[] = [];
  const unitWhere = (where: Record<string, unknown>) =>
    units.filter(
      (u) =>
        (where.id === undefined || u.id === where.id) &&
        (where.prepStartedAt !== null || u.prepStartedAt === null) &&
        (where.prepDoneAt !== null || u.prepDoneAt === null),
    );
  const tx = {
    $queryRaw: async () => [{ status: order.status }],
    orderCombination: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        units.some((u) => u.id === where.id) ? { line: { orderId: 'o1' } } : null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) =>
        units.find((u) => u.id === where.id)!,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Unit> }) =>
        Object.assign(
          units.find((u) => u.id === where.id)!,
          data,
        ),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<Unit>;
      }) => {
        const hit = unitWhere(where);
        for (const u of hit) Object.assign(u, data);
        return { count: hit.length };
      },
      count: async () => units.filter((u) => !u.prepDoneAt).length,
    },
    order: {
      update: async ({ data }: { data: Partial<typeof order> }) => Object.assign(order, data),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<typeof order>;
      }) => {
        const field = 'kitchenStartedAt' in where ? 'kitchenStartedAt' : 'kitchenReadyAt';
        if (order[field] !== null) return { count: 0 };
        Object.assign(order, data);
        return { count: 1 };
      },
    },
    orderEvent: {
      create: async ({ data }: { data: { type: string } }) => {
        events.push(data.type);
        return {};
      },
    },
  };
  const prisma = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const service = new KitchenService(
    prisma,
    { now: () => NOW } as ClockService,
    {} as PlanningService,
  );
  return { service, order, units, events };
}

async function code(run: () => Promise<unknown>) {
  try {
    await run();
    return 'OK';
  } catch (e) {
    if (e instanceof DomainError) return e.code;
    throw e;
  }
}

describe('Kitchen rules (BR-KIT-01..05)', () => {
  it('BR-KIT-01: only confirmed orders can be worked', async () => {
    const { service } = world('PLACED');
    expect(await code(() => service.start('u1', actor))).toBe('INVALID_TRANSITION');
  });

  it('BR-KIT-02: start works once; a second start is a conflict', async () => {
    const { service, units } = world('CONFIRMED');
    expect(await code(() => service.start('u1', actor))).toBe('OK');
    expect(units[0]!.prepStartedAt).toEqual(NOW);
    expect(await code(() => service.start('u1', actor))).toBe('UNIT_ALREADY_STARTED');
  });

  it('BR-KIT-02: done without start records the start at the same instant; done twice is a conflict', async () => {
    const { service, units } = world('CONFIRMED');
    expect(await code(() => service.done('u1', actor))).toBe('OK');
    expect(units[0]!.prepStartedAt).toEqual(NOW);
    expect(units[0]!.prepDoneAt).toEqual(NOW);
    expect(await code(() => service.done('u1', actor))).toBe('UNIT_ALREADY_DONE');
  });

  it('BR-KIT-03: kitchen started once at the first unit; ready only when the last unit is done', async () => {
    const { service, order, events } = world('CONFIRMED');
    await service.done('u1', actor);
    expect(order.kitchenStartedAt).toEqual(NOW);
    expect(order.kitchenReadyAt).toBeNull();
    await service.done('u2', actor);
    expect(order.kitchenReadyAt).toEqual(NOW);
    expect(events).toEqual(['KITCHEN_STARTED', 'KITCHEN_READY']);
  });

  it('BR-KIT-04: force-complete finishes every remaining unit and records it', async () => {
    const { service, order, units, events } = world('CONFIRMED', 3);
    await service.start('u1', actor);
    await service.forceComplete('o1', actor);
    expect(units.every((u) => u.prepDoneAt && u.prepStartedAt)).toBe(true);
    expect(order.kitchenReadyAt).toEqual(NOW);
    expect(events).toContain('KITCHEN_FORCE_COMPLETED');
  });

  it('a person working a demo order switches its autopilot off', async () => {
    const { service, order } = world('CONFIRMED');
    await service.start('u1', actor);
    expect(order.demoAutopilotUntil).toBeNull();
  });
});
