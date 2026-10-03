/**
 * T-605 / NFR-05: "the kitchen board stays fast at 400 orders".
 *
 * On a throwaway Neon branch (see perf-harness.ts): fills today up to 400 confirmed orders through
 * the real API (admin late orders, priced and validated like any other), then times the boards.
 *
 *   pnpm --filter @fernleaf/backend build
 *   pnpm --filter @fernleaf/backend perf:kitchen
 */
import type {
  EmployeeDto,
  KitchenBoardDto,
  MenuDishView,
  OrderContextDto,
  Paginated,
} from '@fernleaf/shared';
import { Client } from 'pg';
import { loadPerfEnv, percentile, type Session, signIn, startApi } from './perf-harness';

const TARGET_ORDERS = 400;
const SAMPLES = 30;

function lineFor(dish: MenuDishView, i: number) {
  const quantity = Math.max(dish.minOrderQty ?? 1, 1) + (i % 3);
  const choices = dish.groups
    .filter((g) => g.isRequired && g.options.length > 0)
    .map((g) => ({
      groupId: g.id,
      optionId: g.options[i % g.options.length]!.optionId,
      portionSizeId: g.usesPortions
        ? (g.portionSizeIds[i % g.portionSizeIds.length] ?? null)
        : null,
    }));
  return { dishId: dish.dishId, quantity, combinations: [{ quantity, choices }] };
}

async function time(session: Session, path: string): Promise<{ ms: number[]; bytes: number }> {
  const ms: number[] = [];
  let bytes = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const started = performance.now();
    const res = await session.send(path, 'GET');
    const body = await res.text();
    ms.push(performance.now() - started);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    bytes = body.length;
  }
  return { ms, bytes };
}

async function main() {
  const env = loadPerfEnv();
  console.log('Starting the API on the throwaway branch…');
  const api = await startApi(env);
  try {
    const admin = await signIn('admin@test.com');
    const kitchen = await signIn('kitchen@test.com');
    const before = await kitchen.get<KitchenBoardDto>('/kitchen/board');
    const today = before.date;
    const missing = Math.max(0, TARGET_ORDERS - before.summary.orders);
    console.log(`Today ${today}: ${before.summary.orders} confirmed orders; creating ${missing}.`);

    // Employees whose company delivers today, with the menu the order builder would show.
    const employees = await admin.get<Paginated<EmployeeDto>>(
      '/employees?active=true&pageSize=100',
    );
    const contexts: OrderContextDto[] = [];
    for (const e of employees.items) {
      const ctx = await admin.get<OrderContextDto>(`/orders/context?employeeId=${e.id}`);
      if (ctx.canOverride && ctx.dates.some((d) => d.date === today)) contexts.push(ctx);
    }
    if (contexts.length === 0) throw new Error('No employee can receive a delivery today.');

    // Employees who may pick a time get one of the last evening slots (new drops). The others
    // keep their company default, unless that delivery has already left today.
    const late = (ctx: OrderContextDto, i: number) =>
      ctx.window.endMinutes - (i % 4) * ctx.window.slotMinutes;
    const blocked = new Set<string>();
    let created = 0;
    let failed = 0;
    let firstError = '';
    const started = performance.now();
    let i = 0;
    while (created < missing && i < missing * 3) {
      const usable = contexts.filter((c) => !blocked.has(c.employee.id));
      if (usable.length === 0) break;
      await Promise.all(
        Array.from({ length: Math.min(8, missing - created) }, async () => {
          const n = i++;
          const ctx = usable[n % usable.length]!;
          const dishes = ctx.menu.flatMap((c) => c.items);
          const lines = [lineFor(dishes[n % dishes.length]!, n)];
          if (n % 2 === 0) {
            const second = dishes[(n * 7 + 3) % dishes.length]!;
            if (second.dishId !== lines[0]!.dishId) lines.push(lineFor(second, n + 1));
          }
          const res = await admin.send('/orders', 'POST', {
            employeeId: ctx.employee.id,
            deliveryDate: today,
            deliveryTimeMinutes: ctx.employee.canChangeDeliveryTime ? late(ctx, n) : null,
            addressId: null,
            packagingTypeId: null,
            notes: '',
            allergenAcknowledged: true,
            lines,
            place: true,
          });
          if (res.ok) created++;
          else {
            failed++;
            const text = await res.text();
            if (text.includes('DROP_ALREADY_DISPATCHED')) blocked.add(ctx.employee.id);
            else firstError ||= `${res.status} ${text}`;
          }
        }),
      );
    }
    const createSeconds = (performance.now() - started) / 1000;
    console.log(
      `Created ${created} orders in ${createSeconds.toFixed(0)} s (${failed} refused; ` +
        `${blocked.size} employees skipped because their delivery had already left).`,
    );
    if (firstError) console.log(`First refusal: ${firstError.slice(0, 300)}`);

    const db = new Client({ connectionString: env.DATABASE_URL });
    await db.connect();
    const rtt: number[] = [];
    for (let k = 0; k < 20; k++) {
      const t = performance.now();
      await db.query('SELECT 1');
      rtt.push(performance.now() - t);
    }
    await db.end();

    const board = await kitchen.get<KitchenBoardDto>('/kitchen/board');
    const station = board.stations.find((s) => s.id)?.id;
    const results = [
      ['GET /kitchen/board', await time(kitchen, '/kitchen/board')],
      [
        'GET /kitchen/board?stationId',
        await time(kitchen, `/kitchen/board?stationId=${station ?? 'unassigned'}`),
      ],
      ['GET /dispatch/board', await time(admin, '/dispatch/board')],
      ['GET /dashboard/admin', await time(admin, '/dashboard/admin')],
      [
        'GET /orders (today, page 1)',
        await time(admin, `/orders?dateFrom=${today}&dateTo=${today}&pageSize=25`),
      ],
    ] as const;

    console.log(
      `\nBoard for ${today}: ${board.summary.orders} orders, ${board.summary.units} prep units, ` +
        `${board.slots.length} slots. ${SAMPLES} sequential requests each, measured from this ` +
        'machine through the local API to Neon. One database round trip from here: ' +
        `p50 ${percentile(rtt, 50)} ms.\n`,
    );
    console.log('| Request | p50 ms | p95 ms | max ms | payload KB |');
    console.log('|---|---|---|---|---|');
    for (const [name, r] of results) {
      console.log(
        `| ${name} | ${percentile(r.ms, 50)} | ${percentile(r.ms, 95)} | ` +
          `${percentile(r.ms, 100)} | ${(r.bytes / 1024).toFixed(0)} |`,
      );
    }
  } finally {
    api.kill();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
