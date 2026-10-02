---
type: phase
id: P8
status: not-started
estimate: 2.5h
target: CP4 Sun 4 Oct 16:30 IST
---

# P8: Company billing

**Goal:** per company, staff invoice uninvoiced billable orders (and pending adjustments) and mark invoices paid. An order is never on two invoices. Post-invoice changes follow the documented policy.

Specs: PRD FR-BIL-*, BR-BIL-*, BR-MNY-03, A-26, A-27 · TRD §8.9 · DATABASE_MODELS §3.9 · ARCHITECTURE §7.5

## Tasks

- [ ] **T-801** Schema: Invoice, InvoiceLine (`orderId` UNIQUE, `adjustmentId` UNIQUE, kind CHECK), OrderAdjustment (≠ 0 CHECK).
- [ ] **T-802** `shared/domain/billing.ts`: eligibility, invoice totals, cancellation credit, shortage credit + cap + **tests BR-BIL-01…09**.
- [ ] **T-803** API: billing summary, uninvoiced per company (orders + adjustments, `upTo` filter), create invoice (TX, unique constraint → `ALREADY_INVOICED`, assert total), list/detail, mark paid (Issued → Paid only) + **concurrency test** (same order in two simultaneous invoices).
- [ ] **T-804** Cancel/reject of **invoiced** orders → `CANCELLATION_CREDIT` adjustment in the same TX; shortage recording (`POST /orders/:id/shortage`) → `SHORT_DELIVERY_CREDIT`; block line edits on invoiced orders.
- [ ] **T-805** Billing UI: company summary table, uninvoiced selection (default: delivered up to a date), create invoice, invoice detail (lines, totals), mark paid; shortage dialog on the order detail.

## Exit criteria

- [ ] Invoice total = Σ lines; order line amount = order total (tests)
- [ ] The policy for changed invoiced orders is implemented and written up for the README ([[Prioritisation Notes]] / [[README Outline]])

## Log

## Outcome
