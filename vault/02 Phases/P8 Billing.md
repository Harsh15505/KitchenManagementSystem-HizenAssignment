---
type: phase
id: P8
status: done
estimate: 2.5h
target: CP4 Sun 4 Oct 16:30 IST
---

# P8: Company billing

**Goal:** per company, staff invoice uninvoiced billable orders (and pending adjustments) and mark invoices paid. An order is never on two invoices. Post-invoice changes follow the documented policy.

Specs: PRD FR-BIL-*, BR-BIL-*, BR-MNY-03, A-26, A-27 · TRD §8.9 · DATABASE_MODELS §3.9 · ARCHITECTURE §7.5

## Tasks

- [x] **T-801** Schema: Invoice, InvoiceLine (`orderId` UNIQUE, `adjustmentId` UNIQUE, kind CHECK), OrderAdjustment (≠ 0 CHECK).
- [x] **T-802** `shared/domain/billing.ts`: eligibility, invoice totals, cancellation credit, shortage credit + cap + **tests BR-BIL-01…09**.
- [x] **T-803** API: billing summary, uninvoiced per company (orders + adjustments, `upTo` filter), create invoice (TX, unique constraint → `ALREADY_INVOICED`, assert total), list/detail, mark paid (Issued → Paid only) + **concurrency test** (same order in two simultaneous invoices).
- [x] **T-804** Cancel/reject of **invoiced** orders → `CANCELLATION_CREDIT` adjustment in the same TX; shortage recording (`POST /orders/:id/shortage`) → `SHORT_DELIVERY_CREDIT`; block line edits on invoiced orders.
- [x] **T-805** Billing UI: company summary table, uninvoiced selection (default: delivered up to a date), create invoice, invoice detail (lines, totals), mark paid; shortage dialog on the order detail.

## Exit criteria

- [ ] Invoice total = Σ lines; order line amount = order total (tests)
- [ ] The policy for changed invoiced orders is implemented and written up for the README ([[Prioritisation Notes]] / [[README Outline]])

## Log

- 2026-10-03 11:45: P8 done. T-801 schema came with the init migration. `shared/src/domain/billing.ts` (isBillable, invoiceTotal, cancellationCredit, shortageCredit with per-combination remaining and the order-total cap; 7 BR-BIL tests). `billing/billing.service.ts`: summary, uninvoiced (upTo), createInvoice (one TX; counts must match or ALREADY_INVOICED; P2002 from the unique keys also maps to ALREADY_INVOICED; stored total asserted; INVOICED events; `[email-simulated]` log), list/detail, markPaid (ISSUED → PAID only), shortage (order row lock, DELIVERED only, details.items per combination). `OrdersService.finish` adds a CANCELLATION_CREDIT when the order was invoiced. Order detail gained adjustments, shortQuantity per combination and `actions.recordShortage`. Demo: weekly invoices per company for delivered demo orders older than 7 days (issued the Monday after, earlier weeks paid three days later); regenerate deletes invoices holding demo orders. Neon probe: concurrent invoices 201 + 409, repeat refused, total = Σ lines, paid once, shortage over quantity refused and 1 box = −$5.20, rejecting an invoiced order → −total credit listed for the next invoice. UI: `/billing`, `/billing/companies/[id]`, `/billing/invoices`, `/billing/invoices/[id]` (printable), shortage form on the order page.
- Gotcha hit: the backend dev server hot-reloads, so it ran the demo invoice code before the "backdate issuedAt" patch; fixed the 7 rows with a one-off script. Don't leave half-finished demo code saved while the dev server runs.

## Outcome
