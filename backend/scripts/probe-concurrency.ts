/**
 * T-1206 / NFR-03: repeatable race and integrity checks, on a throwaway Neon branch only
 * (see perf-harness.ts). Each race fires the same request twice at the same moment through the
 * real API; exactly one must win and the other must get a clear 409. Then SQL checks that every
 * stored total still reconciles.
 *
 *   pnpm --filter @fernleaf/backend build
 *   pnpm --filter @fernleaf/backend probe:concurrency
 */
import type {
  BillingSummaryRow,
  CutoffRunDto,
  KitchenBoardDto,
  UninvoicedDto,
} from '@fernleaf/shared';
import { Client } from 'pg';
import { loadPerfEnv, type Session, signIn, startApi } from './perf-harness';

const results: Array<{ check: string; pass: boolean; detail: string }> = [];
const record = (check: string, pass: boolean, detail: string) => {
  results.push({ check, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${check}: ${detail}`);
};

/** Fires the same request twice at once; returns the two statuses (sorted) and bodies. */
async function twice(session: Session, path: string, body?: unknown) {
  const responses = await Promise.all([
    session.send(path, 'POST', body),
    session.send(path, 'POST', body),
  ]);
  const out = await Promise.all(
    responses.map(async (r) => ({ status: r.status, body: await r.text() })),
  );
  return out.sort((a, b) => a.status - b.status);
}
const oneWins = (r: Array<{ status: number }>) =>
  r[0]!.status >= 200 && r[0]!.status < 300 && r[1]!.status === 409;

async function main() {
  const env = loadPerfEnv();
  const db = new Client({ connectionString: env.DATABASE_URL });
  await db.connect();
  console.log('Starting the API on the throwaway branch…');
  const api = await startApi(env);
  try {
    const admin = await signIn('admin@test.com');
    const kitchen = await signIn('kitchen@test.com');
    const board = await kitchen.get<KitchenBoardDto>('/kitchen/board');
    const today = board.date;
    const units = board.slots.flatMap((s) => s.units).filter((u) => !u.doNotCook);

    // 1. BR-KIT-02: two cooks press "Start" on the same unit.
    const fresh = units.filter((u) => !u.prepStartedAt && !u.prepDoneAt);
    if (fresh[0]) {
      const r = await twice(kitchen, `/kitchen/units/${fresh[0].id}/start`);
      record('Double "start" on one prep unit', oneWins(r), r.map((x) => x.status).join(' + '));
    } else record('Double "start" on one prep unit', false, 'no unstarted unit today');

    // 2. BR-KIT-02: two cooks press "Done" on the same unit.
    const open = fresh[1] ?? units.find((u) => !u.prepDoneAt);
    if (open) {
      const r = await twice(kitchen, `/kitchen/units/${open.id}/done`);
      record('Double "done" on one prep unit', oneWins(r), r.map((x) => x.status).join(' + '));
    } else record('Double "done" on one prep unit', false, 'no open unit today');

    // 3. BR-BIL: two admins invoice the same company at the same moment.
    const summary = await admin.get<BillingSummaryRow[]>('/billing/summary');
    const company = summary.find((c) => c.uninvoicedOrders > 0);
    if (company) {
      const u = await admin.get<UninvoicedDto>(
        `/billing/companies/${company.company.id}/uninvoiced`,
      );
      const r = await twice(admin, '/invoices', {
        companyId: company.company.id,
        orderIds: u.orders.map((o) => o.id),
        adjustmentIds: u.adjustments.map((a) => a.id),
      });
      record(
        'Double invoice for one company',
        oneWins(r) && r[1]!.body.includes('ALREADY_INVOICED'),
        `${r.map((x) => x.status).join(' + ')} (${u.orders.length} orders)`,
      );
    } else record('Double invoice for one company', false, 'nothing uninvoiced');

    // 4. BR-CUT-04/05: cut-off processing run twice at once, then again. Some future placed and
    //    draft orders are moved onto today (whose cut-off has passed) so there is work to do.
    const moved = await db.query<{ status: string }>(
      `UPDATE "Order" SET "deliveryDate" = $1::date
         WHERE id IN (SELECT id FROM "Order" WHERE status IN ('DRAFT','PLACED')
                      AND "deliveryDate" > $1::date ORDER BY "deliveryDate" LIMIT 6)
       RETURNING status`,
      [today],
    );
    const expected = moved.rowCount ?? 0;
    const runs = await Promise.all([
      admin.send('/cutoff/run', 'POST', { deliveryDate: today }),
      admin.send('/cutoff/run', 'POST', { deliveryDate: today }),
    ]);
    const bodies = (await Promise.all(runs.map((r) => r.json()))) as CutoffRunDto[];
    const handled = bodies.reduce((s, b) => s + b.draftsCancelled + b.ordersConfirmed, 0);
    const again = (await (
      await admin.send('/cutoff/run', 'POST', { deliveryDate: today })
    ).json()) as CutoffRunDto;
    record(
      'Cut-off run twice at once, then again',
      runs.every((r) => r.ok) &&
        handled === expected &&
        again.draftsCancelled + again.ordersConfirmed === 0,
      `${expected} orders waiting → runs handled ${bodies
        .map((b) => b.draftsCancelled + b.ordersConfirmed)
        .join(' + ')}, third run ${again.draftsCancelled}/${again.ordersConfirmed}`,
    );

    // 5. Integrity: every stored total reconciles, every company is complete.
    const checks: Array<[string, string]> = [
      [
        'Companies without owner or default address',
        `SELECT count(*) FROM "Company" WHERE "ownerEmployeeId" IS NULL OR "defaultAddressId" IS NULL`,
      ],
      [
        'Combinations where total ≠ unit × qty',
        `SELECT count(*) FROM "OrderCombination" WHERE "totalCents" <> "unitPriceCents" * quantity`,
      ],
      [
        'Lines where qty or total ≠ Σ combinations',
        `SELECT count(*) FROM "OrderLine" l JOIN (SELECT "lineId", sum(quantity) q, sum("totalCents") t
           FROM "OrderCombination" GROUP BY "lineId") c ON c."lineId" = l.id
         WHERE l.quantity <> c.q OR l."totalCents" <> c.t`,
      ],
      [
        'Orders where total ≠ Σ lines',
        `SELECT count(*) FROM "Order" o JOIN (SELECT "orderId", sum("totalCents") t FROM "OrderLine"
           GROUP BY "orderId") l ON l."orderId" = o.id WHERE o."totalCents" <> l.t`,
      ],
      [
        'Invoices where total ≠ Σ lines',
        `SELECT count(*) FROM "Invoice" i JOIN (SELECT "invoiceId", sum("amountCents") t
           FROM "InvoiceLine" GROUP BY "invoiceId") l ON l."invoiceId" = i.id WHERE i."totalCents" <> l.t`,
      ],
    ];
    for (const [name, sql] of checks) {
      const n = Number((await db.query<{ count: string }>(sql)).rows[0]?.count ?? -1);
      record(name, n === 0, `${n} found`);
    }
  } finally {
    api.kill();
    await db.end();
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
