import { describe, expect, it } from 'vitest';
import type { CurrentUserInfo } from '../src/authz/current-user';
import type { ClockService } from '../src/clock/clock.service';
import { DomainError } from '../src/common/domain-error';
import { DispatchService } from '../src/dispatch/dispatch.service';
import type { PlanningService } from '../src/orders/planning.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const TODAY = '2026-10-05';
const DELIVERY_AT = new Date('2026-10-05T07:00:00.000Z'); // 12:30 IST
const dispatcher = { id: 'disp', name: 'Neha Kapoor' } as CurrentUserInfo;
const driver = { id: 'drv', name: 'Ravi Kumar' } as CurrentUserInfo;
const otherDriver = { id: 'drv2', name: 'Imran Shaikh' } as CurrentUserInfo;

function world(opts: { driverId?: string | null; ordersReady?: boolean[]; now?: Date } = {}) {
  const now = opts.now ?? new Date('2026-10-05T06:00:00.000Z');
  const drop = {
    driverId: opts.driverId === undefined ? 'drv' : opts.driverId,
    deliveryDate: new Date(`${TODAY}T00:00:00.000Z`),
    deliveryAt: DELIVERY_AT,
    dispatchReadyAt: null as Date | null,
    outForDeliveryAt: null as Date | null,
    deliveredAt: null as Date | null,
    deliveredOnTime: null as boolean | null,
  };
  const orders = (opts.ordersReady ?? [true, true]).map((ready, i) => ({
    id: `o${i}`,
    status: 'CONFIRMED',
    kitchenReadyAt: ready ? now : null,
  }));
  const events: string[] = [];
  const tx = {
    $queryRaw: async () => [{ id: 'd1' }],
    drop: {
      findUniqueOrThrow: async () => ({ ...drop }),
      update: async ({ data }: { data: Partial<typeof drop> }) => Object.assign(drop, data),
    },
    order: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { status?: string };
        data: { status?: string };
      }) => {
        if (data.status)
          for (const o of orders) if (o.status === where.status) o.status = data.status;
        return { count: orders.length };
      },
      count: async () => orders.filter((o) => o.status === 'CONFIRMED' && !o.kitchenReadyAt).length,
      findMany: async () => orders.map((o) => ({ id: o.id })),
    },
    orderEvent: {
      createMany: async ({ data }: { data: Array<{ type: string }> }) => {
        events.push(...data.map((d) => d.type));
        return { count: data.length };
      },
    },
    deliveryPhoto: { create: async () => ({}) },
  };
  const prisma = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const planning = {
    load: async () => ({ settings: { onTimeGraceMinutes: 5 } }),
  } as unknown as PlanningService;
  const clock = { now: () => now, today: () => TODAY } as unknown as ClockService;
  return { service: new DispatchService(prisma, clock, planning), drop, orders, events };
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

describe('Dispatch rules (BR-DSP-02..05, 07)', () => {
  it('BR-DSP-02: a drop is ready only when every active order is cooked, and only once', async () => {
    const waiting = world({ ordersReady: [true, false] });
    expect(await code(() => waiting.service.markReady('d1', dispatcher))).toBe('DROP_NOT_READY');
    const ok = world();
    expect(await code(() => ok.service.markReady('d1', dispatcher))).toBe('OK');
    expect(await code(() => ok.service.markReady('d1', dispatcher))).toBe('INVALID_TRANSITION');
    expect(ok.events).toEqual(['DISPATCH_READY', 'DISPATCH_READY']);
  });

  it('BR-DSP-03: out for delivery needs a ready drop and a driver', async () => {
    const notReady = world();
    expect(await code(() => notReady.service.markOut('d1', dispatcher))).toBe('INVALID_TRANSITION');
    const noDriver = world({ driverId: null });
    await noDriver.service.markReady('d1', dispatcher);
    expect(await code(() => noDriver.service.markOut('d1', dispatcher))).toBe('DRIVER_REQUIRED');
  });

  it('BR-DSP-04: delivered needs out for delivery; every order becomes Delivered', async () => {
    const w = world();
    expect(await code(() => w.service.deliver('d1', {}, driver, true))).toBe('INVALID_TRANSITION');
    await w.service.markReady('d1', dispatcher);
    await w.service.markOut('d1', dispatcher);
    expect(
      await code(() => w.service.deliver('d1', { note: 'Left at reception' }, driver, true)),
    ).toBe('OK');
    expect(w.orders.every((o) => o.status === 'DELIVERED')).toBe(true);
    expect(await code(() => w.service.deliver('d1', {}, driver, true))).toBe('INVALID_TRANSITION');
  });

  it('BR-DSP-05: on time when delivered within the grace period; stored once', async () => {
    const onTime = world({ now: new Date(DELIVERY_AT.getTime() + 5 * 60_000) });
    await onTime.service.markReady('d1', dispatcher);
    await onTime.service.markOut('d1', dispatcher);
    expect((await onTime.service.deliver('d1', {}, driver, true)).onTime).toBe(true);
    const late = world({ now: new Date(DELIVERY_AT.getTime() + 6 * 60_000) });
    await late.service.markReady('d1', dispatcher);
    await late.service.markOut('d1', dispatcher);
    expect((await late.service.deliver('d1', {}, driver, true)).onTime).toBe(false);
    expect(late.drop.deliveredOnTime).toBe(false);
  });

  it('BR-DSP-07: a driver cannot deliver another driver’s drop', async () => {
    const w = world();
    await w.service.markReady('d1', dispatcher);
    await w.service.markOut('d1', dispatcher);
    expect(await code(() => w.service.deliver('d1', {}, otherDriver, true))).toBe('NOT_FOUND');
    // Dispatch (not acting as a driver) may record it.
    expect(await code(() => w.service.deliver('d1', {}, dispatcher, false))).toBe('OK');
  });
});
