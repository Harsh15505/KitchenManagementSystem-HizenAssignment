---
type: plan
updated: 2026-10-03 01:30 IST
---

# ⏱ Timeline and Checkpoints

**Deadline: Sun 4 Oct 2026, 23:59 IST** (Google Form). Problem statement received Sat 3 Oct, 00:06 IST.

## Budget

- Wall clock from planning start (01:00 Sat) to the deadline: about **47 h**.
- Assume roughly **10–12 h for sleep, food and breaks**, which leaves about **33–36 focused hours**.
- Estimated work (see [[Phase Plan]]): about **39 h**. **We will not do everything**, so the cut lines below apply at the checkpoints. This is expected by the brief ("prioritising is part of the test").

## Checkpoints

These are targets. The owner's sleep schedule wins, but **re-plan at every checkpoint** and write the result in [[STATUS]].

| CP | Target (IST) | Must be true | If behind |
|---|---|---|---|
| CP0 | Sat 3 Oct 02:00 | P0 done: docs + vault + first commit | — |
| CP1 | Sat 3 Oct 13:00 | P1 + P2: skeleton **deployed** (Vercel/Render/Neon); 4 accounts sign in; permissions enforced server-side | Apply **cut line A** |
| CP2 | Sat 3 Oct 21:00 | P3 + P4: catalogue, tiers + grid, menu + preview, companies, employees; seeded | Apply **cut line A** (if not already) and **B** |
| CP3 | Sun 4 Oct 10:00 | P5: orders end to end, cut-off processing, list/detail, demo generator v1 | Apply **cut line B** |
| CP4 | Sun 4 Oct 16:30 | P6 + P7 + P8: kitchen board, dispatch/driver, billing | Apply **cut line C** |
| CP5 | Sun 4 Oct 20:30 | P9 + P10: dashboards, rolling demo data, production verified | Simplify dashboards (still define every figure) |
| CP6 | Sun 4 Oct 22:30 | P11: README final, quality gate, **form submitted** | Submit what works; the README states the gaps honestly |

## Cut lines (in order; never cut a Must silently)

| Cut line | Drop / simplify | Keep |
|---|---|---|
| **A** | CSV import (FR-EMP-03), cut-off preview (FR-SET-04), holiday conflict warning (FR-CMP-05), roles UI | Every Must |
| **B** | Portions **UI** (keep the schema and validation), allergy acknowledgement (keep the warnings), do-not-cook flags, regenerate-demo button | Every Must |
| **C** | Demo **autopilot** (the generator writes time-appropriate states for today instead), money redaction interceptor (kitchen/dispatch see prices; document it), SSE ideas | Every Must |
| Never cut | Server-side permissions, every BR in PRD §5 for Must areas, cut-off processing + manual trigger, kitchen board, dispatch + driver, billing policy, dashboards with definitions, live data for "today", README sections, business-rule tests | — |

Every cut is logged in [[Prioritisation Notes]] (it becomes the README's "skipped and why").

## Schedule log

| When (IST) | Event |
|---|---|
| 2026-10-03 00:06 | Problem statement received |
| 2026-10-03 00:25–01:45 | S01 planning: analysis, owner decisions, docs, vault |
| 2026-10-03 02:00–03:15 | P1 code done (T-101…T-107), CI green; Render blueprint ready |
| 2026-10-03 03:15–06:15 | P2 done locally (auth, CASL, staff, settings, reference); **7 h ahead of CP1**, deploy pending owner |
