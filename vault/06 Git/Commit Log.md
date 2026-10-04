---
type: log
updated: 2026-10-04 19:05 IST
---

# 🧷 Commit Log

One row per commit, newest at the bottom. `git log` is the source of truth for hashes. A commit can't contain its own hash, so add the row in the next commit, or regenerate the table with `pnpm vault:commits` once T-110 exists.

| # | Date (IST) | Hash | Message | Tasks | Phase |
|---|---|---|---|---|---|
| 1 | 2026-10-03 02:05 | bf84a7f | vault formation complete | T-001…T-006 | P0 |
| 2 | 2026-10-03 02:13 | 87abdf9 | build: scaffold pnpm workspace root for frontend, backend and shared | T-101 | P1 |
| 3 | 2026-10-03 02:16 | ea601c9 | build(shared): add shared package with money helpers and tests | T-102, BR-PRC-03, BR-MNY-01 | P1 |
| 4 | 2026-10-03 02:24 | 1a1a0a4 | feat(backend): add NestJS API skeleton with health check and error envelope | T-103 | P1 |
| 5 | 2026-10-03 02:34 | 9fd0959 | feat(db): add Prisma 7 schema with check constraints on Neon | T-104 | P1 |
| 6 | 2026-10-03 02:43 | 8392d16 | feat(frontend): add Next.js 16 app with API rewrite and login redirect | T-105 | P1 |
| 7 | 2026-10-03 02:45 | 33cb145 | build: add ESLint and Prettier across the workspace | T-106 | P1 |
| 8 | 2026-10-03 02:47 | ee9472d | ci: run format, lint, typecheck, tests and build on every push | T-107 | P1 |
| 9 | 2026-10-03 02:49 | 1aed8b7 | build: add Render blueprint for the API service | T-108 | P1 |
| 10 | 2026-10-03 02:53 | 9d810d5 | feat(shared): add permission catalogue and CASL rules from permission codes | T-201, FR-ACC-04, BR-ACC-01, BR-DSP-07 | P2 |
| 11 | 2026-10-03 02:56 | f7dd3a4 | feat(shared): add kitchen time helpers and a server clock | T-209, NFR-02, ADR-006 | P2 |
| 12 | 2026-10-03 02:58 | 3715389 | feat(db): seed roles, reviewer accounts and platform settings | T-202, FR-ACC-01 | P2 |
| 13 | 2026-10-03 03:04 | 51fbd36 | feat(backend): cookie sessions and CASL access control on every route | T-203, T-204, FR-ACC-01, FR-ACC-03, FR-ACC-05, BR-ACC-02, BR-ACC-03 | P2 |
| 14 | 2026-10-03 05:41 | bf2f16b | feat(frontend): sign-in form and permission-driven app shell | T-205, FR-ACC-01, FR-ACC-04, FR-DSH-01 | P2 |
| 15 | 2026-10-03 05:42 | f387720 | docs(vault): refresh status after P2 auth work |  | P2 |
| 16 | 2026-10-03 05:50 | 0d78fc9 | feat: staff management with session revocation and self-lockout guard | T-206, FR-ACC-02, BR-ACC-02 | P2 |
| 17 | 2026-10-03 05:59 | 8125bf1 | feat: platform settings, kitchen holidays and admin-managed reference lists | T-207, T-208, FR-SET-01, FR-SET-02, FR-SET-03 | P2 |
| 18 | 2026-10-03 06:02 | d7b559d | test(backend): permission matrix on the real application module | T-210, FR-ACC-03 | P2 |
| 19 | 2026-10-03 06:05 | 8b9081a | feat(shared): resolve tier prices with derivation, overrides and exclusions | T-306, BR-PRC-01, BR-PRC-02, BR-PRC-03, BR-PRC-04, BR-PRC-05 | P3 |
| 20 | 2026-10-03 06:07 | f242d57 | feat(shared): resolve an employee's menu with hiding, secrets and pricing | T-311, BR-MEN-01, BR-MEN-02, BR-MEN-03, BR-MEN-04, FR-PRC-04 | P3 |
| 21 | 2026-10-03 06:13 | 70c6d5e | feat(backend): catalogue API for dishes, options and option groups | T-302, T-303, T-304, FR-CAT-01..05 | P3 |
| 22 | 2026-10-03 06:27 | 67c38e0 | fix(shared): keep omitted fields on partial dish and option updates | T-302, T-303, BUG-003 | P3 |
| 23 | 2026-10-03 06:27 | c01e586 | feat(frontend): catalogue screens for dishes, options and option groups | T-302, T-303, T-304, BUG-004 | P3 |
| 24 | 2026-10-03 06:27 | e95775a | docs(vault): catalogue done, BUG-003/004, rebuilt commit log | T-302, T-303, T-304 | P3 |
| 25 | 2026-10-03 06:37 | be31f2d | feat(shared): pricing contracts and tier factor parsing | T-307, T-308 | P3 |
| 26 | 2026-10-03 06:37 | 659658e | feat(backend): price tiers, default switch and tier grid API | T-307, T-308 | P3 |
| 27 | 2026-10-03 06:37 | 108fd8a | feat(frontend): price tier list and tier price grid | T-307, T-308 | P3 |
| 28 | 2026-10-03 06:37 | 4f19d92 | docs: tiers and grid done, ADR-026 plain-table tier grid | T-307, T-308 | P3 |
| 29 | 2026-10-03 06:44 | 8f982d7 | feat(shared): menu category contracts and slugify | T-310 | P3 |
| 30 | 2026-10-03 06:44 | 137f809 | feat(backend): menu categories and items API | T-310, BUG-005 | P3 |
| 31 | 2026-10-03 06:44 | 356f858 | feat(frontend): menu management screen | T-310 | P3 |
| 32 | 2026-10-03 06:44 | 999ac67 | docs(vault): menu management done, BUG-005, timestamp fixes | T-310 | P3 |
| 33 | 2026-10-03 06:50 | 1e04d8c | feat(db): seed catalogue, price tiers and menu for the demo | T-313 | P3 |
| 34 | 2026-10-03 06:50 | 62e9ad5 | docs(vault): catalogue seed done, P3 left with the menu preview | T-313 | P3 |
| 35 | 2026-10-03 06:55 | 33f2bae | feat(shared): company and employee rules and contracts | T-402…T-405, T-408 | P4 |
| 36 | 2026-10-03 06:55 | dc7e1a9 | feat(backend): companies and employees API | T-402…T-405 | P4 |
| 37 | 2026-10-03 07:07 | 6f278ee | test(backend): owner guard, domain checks and create-company refusals | T-408 | P4 |
| 38 | 2026-10-03 07:07 | 32d5a4f | feat(frontend): companies and employees screens | T-402…T-405 | P4 |
| 39 | 2026-10-03 07:07 | a22e8e8 | feat(db): seed five client companies and sixty employees | T-407 | P4 |
| 40 | 2026-10-03 07:07 | 9252fe7 | docs(vault): P4 companies and employees done, CSV import deferred | T-401…T-408 | P4 |
| 41 | 2026-10-03 07:14 | a699da9 | feat(backend): employee menu endpoints on one shared menu loader | T-312 | P3 |
| 42 | 2026-10-03 07:14 | 7933421 | feat(frontend): menu preview as an employee | T-312 | P3 |
| 43 | 2026-10-03 07:14 | a5ec8fa | docs(vault): P3 complete with the menu preview | T-312 | P3 |
| 44 | 2026-10-03 07:16 | 8633865 | feat(shared): cut-off, deliverability, plans and order combinations | T-502, T-503 | P5 |
| 45 | 2026-10-03 07:16 | 0ebac0d | docs: ADR-027 combination signature sorted by ids | T-503 | P5 |
| 46 | 2026-10-03 10:42 | 26128e0 | feat(shared): order, quote, override and cut-off contracts | T-504…T-512 | P5 |
| 47 | 2026-10-03 10:42 | 651a5f6 | feat(backend): orders, cut-off processing and the cut-off scheduler | T-504…T-512 | P5 |
| 48 | 2026-10-03 10:49 | a35e92d | feat(frontend): order builder, order list and detail, cut-off page | T-507, T-510…T-512 | P5 |
| 49 | 2026-10-03 10:54 | 51fbed6 | feat(backend): rolling demo window and demo autopilot | T-513 | P5 |
| 50 | 2026-10-03 10:55 | 8fb1b17 | chore: drop a local check script and ignore *.tmp.ts | - | P5 |
| 51 | 2026-10-03 10:58 | 01da825 | docs(vault): P5 orders, cut-off and demo window done | T-501…T-513 | P5 |
| 52 | 2026-10-03 11:04 | 8c77fa3 | feat(backend): kitchen board, prep units and force-complete | T-601…T-603 | P6 |
| 53 | 2026-10-03 11:04 | d5ba25e | feat(frontend): kitchen board with station chips and prep summary | T-604 | P6 |
| 54 | 2026-10-03 11:06 | a918c84 | docs(vault): P6 kitchen board done | T-601…T-604 | P6 |
| 55 | 2026-10-03 11:20 | 17cc877 | feat(backend): dispatch board, driver drops and proof of delivery | T-701, T-702, T-704, T-706 | P7 |
| 56 | 2026-10-03 11:20 | 4d24ca5 | feat(frontend): dispatch board and the driver's phone view | T-703, T-705 | P7 |
| 57 | 2026-10-03 11:22 | 594c589 | docs(vault): P7 dispatch and driver done; tidy STATUS | T-701…T-706 | P7 |
| 58 | 2026-10-03 11:45 | 672b4ce | feat(billing): invoices, credits for later changes and demo invoices | T-801…T-804 | P8 |
| 59 | 2026-10-03 11:45 | b883799 | feat(frontend): billing summary, invoice builder, invoices and shortages | T-805 | P8 |
| 60 | 2026-10-03 11:47 | 17a8300 | docs(vault): P8 billing done | T-801…T-805 | P8 |
| 61 | 2026-10-03 12:05 | c38284d | feat(backend): admin dashboard figures and kitchen board additions | T-901, T-902, T-905 | P9 |
| 62 | 2026-10-03 12:05 | d0ddbda | feat(frontend): role dashboards for admin, kitchen, dispatch and driver | T-901…T-904 | P9 |
| 63 | 2026-10-03 12:07 | 53ec8d3 | docs(vault): P9 dashboards done | T-901…T-905 | P9 |
| 64 | 2026-10-03 12:12 | 7d28a4a | feat: demo data status and regenerate in Settings; re-arm cut-off timer | T-1004 | P10 |
| 65 | 2026-10-03 12:18 | 3e4fc2e | docs: README with setup, architecture, data model and dashboard definitions | T-1101 | P11 |

| 66 | 2026-10-03 11:39 | 7ee01fd | docs(vault): session S02 handoff, P10 progress, STATUS for deploy | — | P10 |
| 67 | 2026-10-03 12:24 | bffda6e | docs(vault): correct stale Requirements Matrix rows | — | P11 |
| 68 | 2026-10-03 12:32 | c7d7fff | fix(frontend): wrap the account menu label in a menu group | BUG-006 | P11 |
| 69 | 2026-10-03 12:48 | 0175a3e | fix(frontend): build the shared package before next build | T-1102 | P11 |
| 70 | 2026-10-03 12:56 | 1274dec | docs: live links for the deployed web app and API | T-1102 | P11 |
| 71 | 2026-10-03 12:56 | 166de88 | docs(vault): STATUS after deploy | T-1102 | P11 |
| 72 | 2026-10-03 15:36 | da6be4f | fix(frontend): own panel for "do not cook" on the kitchen dashboard | T-902 | P11 |
| 73 | 2026-10-03 15:36 | 1ef28dc | docs(vault): deployed, keep-alive on, owner smoke test passed | T-1102 | P11 |
| 74 | 2026-10-03 15:57 | 268744d | fix(frontend): build shared only when missing, to stop the CI build race | T-1102 | P11 |
| 75 | 2026-10-03 16:23 | 3034119 | feat(frontend): warm Fernleaf brand theme with dark mode | T-UI (ADR-028) | Polish |
| 76 | 2026-10-03 16:23 | a90a3fc | docs(vault): ADR-028 brand theme and dark mode; gotchas | T-UI | Polish |
| 77 | 2026-10-03 17:22 | 9d9525c | feat(frontend): rebuilt dashboards with charts, count-up and motion | T-UI | Polish |
| 78 | 2026-10-03 17:27 | 3f92e86 | feat(frontend): polished kitchen, dispatch and driver boards | T-UI | Polish |
| 79 | 2026-10-03 17:33 | 3a77ded | feat(frontend): order lifecycle stepper, timeline rail, billing metrics | T-UI | Polish |
| 80 | 2026-10-03 17:33 | 8dad0b2 | docs(vault): UI redesign done; commit log backfilled; STATUS | T-UI | Polish |
| 81 | 2026-10-03 18:01 | 9c6e749 | feat(frontend): circular reveal animation when switching theme | T-UI | Polish |
| 82 | 2026-10-03 18:02 | 2760d11 | docs(vault): theme switch animation noted | T-1204 | P12 |
| 83 | 2026-10-03 18:47 | 4730b23 | docs(vault): full catch-up after deploy and redesign; plan P12 | T-1102, T-1207 | P12 |
| 84 | 2026-10-03 18:55 | 2972ad6 | feat: warn about open orders when adding a company or kitchen holiday | T-409 | P12 |
| 85 | 2026-10-03 19:02 | a77195c | feat(frontend): form screens pass: order builder steps, inputs, new company | T-1205, BUG-012 | P12 |
| 86 | 2026-10-03 19:57 | 31d98c7 | feat: import employees from a CSV file with a per-row report | T-406 | P12 |
| 87 | 2026-10-03 19:58 | 6bd6d92 | test(backend): repeatable perf and concurrency scripts on a throwaway branch | T-605, T-1206 | P12 |
| 88 | 2026-10-03 20:02 | 1f65a6c | docs: README screenshots, final decisions and prioritisation pass (CI failed: BUG-013) | T-1207 | P12 |
| 89 | 2026-10-03 22:46 | 951935c | perf(backend): load nested relations with joins; record perf and race results | T-605, T-1206, ADR-030, BUG-013 | P12 |
| 90 | 2026-10-04 14:41 | e01dea5 | feat: auto-generated dish SKU, plain rate-limit message, row actions on lists | FR-CAT-01, BUG-014/015, ADR-031 | P12 |
| 91 | 2026-10-04 18:20 | 88ff695 | feat(frontend): new favicon, bento dashboards, structured detail lists | ADR-028, BUG-016 | P12 |
