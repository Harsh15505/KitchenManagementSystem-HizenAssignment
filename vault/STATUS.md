---
type: status
updated: 2026-10-03 14:30 IST
phase: deployed; keep-alive + live smoke test left
active_task: T-109
---
# 📍 STATUS: live snapshot

> **Update this note at the end of every task and every session.** It's the first thing the next agent reads.

## TL;DR

P0–P7 are done locally and CI is green: auth and permissions, staff, settings, catalogue, pricing tiers and grid, menu and preview, companies and employees, orders with cut-off processing, the kitchen board, the dispatch board, the driver view, billing and the role dashboards. A rolling demo window (~700 orders over −14…+7 days) plus an autopilot keeps every screen live. **Deployed**: web https://ktichen-management-hizen.vercel.app, API https://fernleaf-api-l0yq.onrender.com. The README is written. Next: UptimeRobot keep-alive (T-109) and the owner's signed-in smoke test (T-1005/T-1006).

## ⏳ Deadline

**Sun 4 Oct 2026, 23:59 IST.** Checkpoints: [[Timeline and Checkpoints]].

## Current phase

- **P0**: ✅ → [[P0 Planning]]
- **P1**: code ✅ (T-101…T-107); **T-108 deploy** waiting on owner; T-109 keep-alive after deploy → [[P1 Foundation]]
- **P2**: ✅ locally (T-201…T-210) → [[P2 Auth and Access]]
- **P3**: ✅ → [[P3 Catalogue Pricing Menu]]
- **P4**: ✅ Musts (T-401…405, 407, 408); T-406 CSV import deferred → [[P4 Companies and Employees]]
- **P5**: ✅ (T-501…T-513) → [[P5 Orders and Cutoff]]
- **P6**: ✅ (T-601…T-604; T-605 perf partly) → [[P6 Kitchen Board]]
- **P7**: ✅ (T-701…T-706) → [[P7 Dispatch and Driver]]
- **P8**: ✅ (T-801…T-805) → [[P8 Billing]]
- **P9**: ✅ (T-901…T-905) → [[P9 Dashboards]]
- **P10**: 🟨 demo window, autopilot, invoices, Settings card done; deploy + live smoke test pending → [[P10 Demo Data and Deploy]]
- **P11**: 🟨 README written; live links to add after deploy

## 🔨 Active task

- **T-109** UptimeRobot: HTTP(s) monitor on https://fernleaf-api-l0yq.onrender.com/api/health every 5 minutes. **T-1005** owner signs in with the 4 accounts on the live site (the agent may not enter passwords on deployed sites).

## ⏭ Next up (in order)

1. Deploy (T-108/T-109/T-1005/T-1006) · README live links · optional Shoulds (CSV import, holiday warning)

## ⛔ Blockers / waiting on owner

- None blocking. Vercel build fix: frontend build now builds `shared` first (0175a3e).
- Optional: rotate the Neon password (it was pasted in chat) and update `backend/.env` + Render.

## 🌐 Environments

| Env | URL | Status |
|---|---|---|
| Repo (GitHub) | https://github.com/Harsh15505/KitchenManagementSystem-HizenAssignment | ✅ CI green |
| DB (Neon) | `ep-autumn-forest…ap-southeast-1` | ✅ migrated (46 tables, 30 CHECKs), seeded (roles, 7 staff, reference lists, 27 dishes, 17 options, 4 tiers, 8 menu categories, 5 companies, 60 employees) |
| API (Render) | https://fernleaf-api-l0yq.onrender.com | ✅ live (health + DB ready green) |
| Web (Vercel) | https://ktichen-management-hizen.vercel.app | ✅ live; Render `WEB_ORIGIN` set to it (origin check verified) |

## ✅ Verified locally (2026-10-03 06:30)

- `pnpm lint / typecheck / test` clean; 319 tests (112 shared, 207 backend).
- Pricing (06:40): Neon probe of tiers, cycles, grid, bulk set/exclude/clear, default switch, guarded delete; browser check of `/pricing` and the grid.
- Browser (admin): create option with size extra; create dish (client validation, SKU upper-cased, station, allergen); add option group (portion error surfaced from the API, then valid save), edit, remove; deactivate/reactivate; list filters.
- Browser (kitchen): catalogue read-only, no money columns.
- Found and fixed BUG-003 and BUG-004 (see [[Bug Tracker]]).

## 🧾 Key decisions

ADR-001…ADR-026 in [[Decision Log]]. Latest: ADR-025 shadcn on Base UI, ADR-026 tier grid as a plain table.

## 🧷 Last commit

See [[Commit Log]] (rebuilt from `git log` at 06:30).

## 🤝 Handoff notes for the next agent

- Read [[AGENT PROTOCOL]] first. Every task updates the Task Board, phase note, Requirements Matrix and this note.
- Routes need `@Public`, `@AnyUser` or `@CheckPolicies`, or the app won't boot (by design).
- Don't `import type` classes that Nest injects (see [[Gotchas]]).
- Update schemas: never `.partial()` a schema with defaults (BUG-003). Money UI: gate on `read Money` (BUG-004).
- Local dev: `.claude/launch.json` has `backend` (:4000) and `frontend` (:3000). After rebuilding `shared`, restart the backend.
- Browser probes create real rows in Neon: name them `ZZ Probe…` / `ZZ-PROBE-…` and delete them afterwards.
