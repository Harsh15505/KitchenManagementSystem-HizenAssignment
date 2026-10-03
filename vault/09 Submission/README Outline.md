---
type: plan
updated: 2026-10-03 18:55 IST
---

# 📝 README Outline (assembled in T-1101)

> **Status:** all 16 sections are in `README.md` (2026-10-03 12:18, sections 1–13 there). Live links updated 18:55. Left for T-1207: screenshots, perf/concurrency numbers in §11, a line on the UI theme in §8.

The brief requires **setup · architecture overview + data model diagram · key decisions and trade-offs · dashboard definitions · prioritisation notes**. The email also asks for an explanation of the approach. Each section below lists its source, so writing the README is assembly, not authoring.

| # | Section | Source |
|---|---|---|
| 1 | **Fernleaf Kitchen Ops**: one-paragraph pitch + live links + test accounts table | `docs/PRD.md` §1, §2.1; [[Environments and Deploy]] |
| 2 | **Quick tour for reviewers**: what to click per role, in 5 minutes (incl. Cut-off "Run now", autopilot note, regenerate) | `docs/PRD.md` §1.3; [[Submission Checklist]] |
| 3 | **Local setup** | [[Runbook]] (verified commands) |
| 4 | **Architecture overview**: context + deployment diagram, monorepo layout, request pipeline | `docs/ARCHITECTURE.md` §2–6 |
| 5 | **Data model**: Mermaid ERD (overview) + key modelling choices (snapshots, combination = prep unit, drops, invoice lines unique, default tier FK) | `docs/DATABASE_MODELS.md` §2, §3, §6 |
| 6 | **Business rules and how they're enforced**: cut-off, pricing, combinations, billing policy, concurrency | `docs/PRD.md` §5; `docs/DATABASE_MODELS.md` §6, §9 |
| 7 | **Time zone statement**: "Kitchen operates in Asia/Kolkata (IST); …" + how we guarantee TZ independence | ADR-006; `docs/TRD.md` §5.8 |
| 8 | **Money**: integer cents (USD), 5-cent ceiling, reconciliation | ADR-005; `docs/TRD.md` §5.9 |
| 9 | **Billing policy for changed invoiced orders** | ADR-015; `docs/PRD.md` BR-BIL-* |
| 10 | **Dashboards**: per role: what we show and why, exact calculation of each figure, what we chose not to show | `docs/PRD.md` §8 (update if the implementation changed) |
| 11 | **Key decisions and trade-offs** (ADR table) | `docs/ARCHITECTURE.md` §10 |
| 12 | **Prioritisation**: built / skipped / why / next with more time | [[Prioritisation Notes]] + [[Requirements Matrix]] |
| 13 | **Ambiguities and interpretations** | `docs/PRD.md` §10 (A-01…A-40), trimmed to the important ones |
| 14 | **Testing**: what's covered (BR IDs), how to run, TZ matrix | `docs/TRD.md` §9 |
| 15 | **Demo data**: rolling window, autopilot, 7-day kitchen rationale | ADR-017; [[Demo Data Plan]] |
| 16 | **AI usage note**: tools used; every line understood (brief requirement) | session logs |

Style: scannable headings, tables, short paragraphs; diagrams in Mermaid (GitHub renders them).
