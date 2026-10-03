---
type: log
updated: 2026-10-03 18:47 IST
---

# ⚖️ Prioritisation Notes (living, feeds the README)

Write an entry **at the moment** something is cut, simplified or deferred, or when an interpretation is made during implementation. The README's "what we built, what we skipped and why, what's next" is assembled from this note plus the [[Requirements Matrix]].

## Principles (fixed at planning time)

1. Every [Must] in the brief is done properly before any [Should].
2. Correctness (rules, money, time, permissions) beats breadth of UI.
3. Deploy early; keep the live app working at every checkpoint.
4. Cuts follow the predefined cut lines A → B → C ([[Timeline and Checkpoints]]) and are written down here.

## Built

| Area | What | Phase |
|---|---|---|
| Access | Login, CASL abilities from permission codes, staff with self-lockout guards and session revocation, money redaction | P2 |
| Setup | Settings, kitchen holidays, public domains, reference lists, cut-off preview (Should) | P2, P5 |
| Food and prices | Dishes, options, groups with portions (Should), 4 tiers with derivation, overrides, exclusions and a missing-price grid; menu with secret slug and per-employee preview | P3 |
| Customers | Companies (domains, addresses, holidays + conflict warning), employees with moves and ownership, CSV import with a per-row report | P4, P12 |
| Orders | Builder with live server quotes, allergy acknowledgement (Should), cut-off lock + idempotent processing, admin late orders and overrides, list/detail | P5 |
| Operations | Kitchen board, dispatch board, driver phone view with photos, on-time | P6, P7 |
| Billing | Invoices, paid, credits for invoiced cancels and shortages | P8 |
| Insight | Four role dashboards with written definitions | P9 |
| Demo + deploy | Rolling window, autopilot (Should), regenerate (Should); live on Vercel + Render + Neon with keep-alive | P10 |
| Polish | Warm brand theme, dark mode, dashboards and boards rebuilt with motion | P12 (ADR-028) |

## Interpretations made during the build

| When (IST) | Topic | Interpretation |
|---|---|---|
| 2026-10-03 06:00 | Self-lockout | An admin cannot deactivate their own account or change their own role, so the last admin can't lock everyone out. Changing another user's role, deactivating them or resetting their password signs them out everywhere (token version) |
| 2026-10-03 07:06 | Removing a company domain | Refused while it is the last domain or while active employees use it. Inactive employees may keep an old address; they are re-checked if edited or moved |
| 2026-10-03 07:06 | Deactivating an owner | Treated like a move (BR-EMP-02): transfer ownership first |
| 2026-10-03 06:40 | Excluded vs missing prices | "Missing" counts on the tier list mean no price and no decision; an explicit "not sold" is a decision and isn't counted. Both hide the dish from that tier's employees |
| 2026-10-03 07:16 | Counting cut-off days | Kitchen working days strictly before the delivery date; N = 0 means the cut-off is on the delivery day |
| 2026-10-03 07:16 | Lock vs processing | Locking is time-based; processing changes statuses, so a stale order can never be edited after its cut-off |
| 2026-10-03 10:42 | Orders after the cut-off | Admin late orders are created directly as Confirmed; drafts for locked dates aren't allowed, which keeps processing idempotent |
| 2026-10-03 10:42 | Admin powers after confirmation | Cancel, reject, change time/address/packaging; no line edits (cancel and re-create, or record a shortage) |
| 2026-10-03 11:45 | Invoiced orders that change | Invoices never change; cancellations and shortages become credits on the next invoice |
| 2026-10-03 05:45 | Admin vs driver views | The admin role has every permission except the driver-only ones (`delivery.perform`, `dashboard.driver`); admins act on drops through dispatch permissions |

## Skipped / simplified

| When (IST) | Item | Priority | Why | What we'd do with more time |
|---|---|---|---|---|
| 2026-10-03 (plan) | Exports, accounting, payments, notifications… | Out of scope | Excluded by the brief | — |
| 2026-10-03 (plan) | Roles editor UI (FR-ACC-06) | Could | Roles are data already; seed is enough to add one | Admin page with permission checkboxes |
| 2026-10-03 (plan) | Invoice void/reissue | Could | Adjustments cover corrections; fewer states | Void + reissue flow with a reason |
| 2026-10-03 07:06 | Employee CSV import (FR-EMP-03, T-406) | Should | Every Must comes first (P5–P9 are still ahead); seeded employees cover the demo. **Built 2026-10-03 19:57 (T-406)** | Template download, per-row validation with the same `createEmployeeSchema` + domain check, report `{row, column, message}` |
| 2026-10-03 07:06 | Company-holiday conflict warning (FR-CMP-05) | Should | Needs orders (P5); revisit after P5. **Built 2026-10-03 18:55 (T-409)**: company and kitchen holidays warn and list open orders | On holiday create, list open orders on that date and warn |
| 2026-10-03 (plan) | Admin line edits after confirmation | Could | Would desync kitchen units and invoiced amounts | Re-plan units + adjustment if already invoiced |
| 2026-10-03 11:05 | 400-order kitchen board perf run (T-605) | NFR | Time; measured a 48-order day (~580 ms from India). **Scheduled Sun AM** on a throwaway branch | Synthetic 400-order day, p50/p95 |
| 2026-10-03 (P5–P8) | Automated DB-backed race tests | NFR | No test database in CI (ADR-029); races verified by probes | **T-1206** repeatable probe script; later a Neon branch per CI run |

## Next steps with more time

- Real-time boards (SSE) instead of polling
- Object storage for photos; dish image upload
- Notifications module (outbox) replacing simulated emails
- E2E tests (Playwright) for the reviewer paths
- Multi-kitchen support (data model extension in `docs/DATABASE_MODELS.md` §10)
