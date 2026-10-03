---
type: phase
id: P2
status: done (live check pending T-108)
estimate: 3h
target: CP1 Sat 3 Oct 13:00 IST
---

# P2: Auth, access, staff and settings

**Goal:** the four test accounts sign in. Every API route is permission-guarded (fail-closed). The UI shell is permission-driven. Settings, reference data and the clock exist.

Specs: PRD FR-ACC-*, FR-SET-*, BR-ACC-* · TRD §5.3–5.5, §5.8 · ADR-003, ADR-004, ADR-006, ADR-023

## Tasks

- [x] **T-201** Permission catalogue + default role mapping in `@fernleaf/shared/permissions`, plus **CASL rules** `buildRules(user)` in `@fernleaf/shared/authz` (TRD §5.5) with unit tests of each seeded role's abilities; ESLint rule against role-name literals outside seeds.
- [x] **T-202** Seed (idempotent): roles with permissions; the **4 test accounts with `Test@1234`** + 2 extra drivers + 1 extra cook; settings singleton (kitchen 7 days, cut-off 2 days at 16:00); the default tier (placeholder until P3).
- [x] **T-203** Auth module: `POST /auth/login` (throttled, generic errors), `POST /auth/logout`, `GET /auth/me`; JWT in the `fl_session` cookie (HttpOnly, Secure, SameSite=Lax, no Domain); `tokenVersion`; Origin check on mutations.
- [x] **T-204** Global `AuthGuard` + CASL `AbilityFactory` (`createPrismaAbility` through the `@casl/prisma/runtime` wrapper for Prisma 7) + `PoliciesGuard` / `@CheckPolicies` + `@Public` + a boot-time check that every route is decorated; `@CurrentUser`; `MoneyRedactionInterceptor` (strip `*Cents` when `ability.cannot('read', 'Money')`).
- [x] **T-205** Frontend: login page (demo-account hints), `MeProvider` + CASL `AbilityProvider` (`buildRules` from the `/auth/me` codes), `<Can>` / `useAbility`, nav config filtered by ability, `RequireAbility` page guard, 403/404 pages, kitchen clock (IST) in the top bar; `/dashboard` placeholder sections per dashboard ability.
- [x] **T-206** Staff management API + UI: list, create (role, initial password), change role, deactivate (bumps tokenVersion), reset password.
- [x] **T-207** Settings API + UI: platform values, kitchen working days, kitchen holidays, public-domain blocklist, toggles; *(Should)* cut-off preview.
- [x] **T-208** Reference data API + UI: allergens, dietary tags, kitchen stations, portion sizes, packaging types (deactivate if in use).
- [x] **T-209** `ClockService` + `shared/domain/time.ts` (CalendarDate, `toInstant`, `toKitchenDate`, `addDays`, `isoWeekday`, `toDbDate`/`fromDbDate`) + TZ-matrix tests; `GET /meta/clock`.
- [x] **T-210** Integration test: permission matrix (each seeded role × representative routes → 200/403); the driver can't list orders; the kitchen gets no `*Cents` fields.

## Exit criteria

- [ ] Each of the 4 accounts signs in **on the live app** and sees only its nav
- [ ] Direct API calls outside the role → 403 (verified by T-210)
- [ ] Settings editable in the UI (no DB edits)

## Log

- 2026-10-03 03:30: T-201 done. `shared/src/permissions/catalogue.ts` (39 codes), `default-roles.seed.ts` (4 roles per TRD §5.5), `shared/src/authz/rules.ts` (`buildRules`/`defineAbilityFor`; exhaustive `Record<PermissionCode, Grant>`; typed `DropSubject` so conditions are type-checked; drop actions `assignDriver`/`markReady`/`sendOut`/`deliver`). 7 tests (role matrix, driver row rule BR-DSP-07, unknown codes ignored). ESLint role guard narrowed to comparisons only (`===`, `case`, `.includes`). TRD §5.5 snippet synced.
- 2026-10-03 03:45: T-209 done. `shared/src/domain/time.ts` (branded CalendarDate, addDays, isoWeekday, toInstant via @date-fns/tz, toLocalDate, HH:mm helpers, toDbDate/fromDbDate) with 10 tests passing under TZ=UTC/LA/Kolkata, including a DST zone. Backend `ClockService` (the only wall-clock read) + `GET /api/meta/clock`; verified with the server in TZ=America/Los_Angeles: today = 2026-10-03 (IST) while UTC was still 2 Oct.
- 2026-10-03 04:00: T-202 done. Idempotent seed (`backend/prisma/seed/`, `pnpm --filter @fernleaf/backend db:seed`): Standard tier (FROM_COST ×2.4) + settings singleton (IST, 7-day kitchen, cut-off 2 days at 16:00) + 4 roles from DEFAULT_ROLES + 7 staff. Reviewer passwords are re-asserted on every run; extra staff get random passwords. Ran twice against Neon; verified 4 × `Test@1234` with bcrypt.
- 2026-10-03 04:30: T-203 + T-204 done. `backend/src/auth` (login with timing-safe generic error, logout, me; throttled 10/min) and `backend/src/authz`: one global `AccessGuard` (session → live user, tokenVersion + isActive → CASL policies), `@Public`/`@AnyUser`/`@CheckPolicies`, fail-closed boot check (`RouteAccessCheck`), `MoneyRedactionInterceptor`, `OriginCheckMiddleware`, `trust proxy`. JWT_SECRET via Render `generateValue`. 9 new tests (cookie flags, same error for wrong pw/unknown email, 401/403, money redaction, revocation, boot check). Verified on the real API + Neon: 4 accounts sign in; no-cookie 401; foreign Origin 403. The @casl/prisma runtime wrapper is deferred to T-704 (first row-filtered query).
- 2026-10-03 05:45: T-205 done. Frontend sign-in (RHF + shared `loginSchema`, field errors from the API, safe `?next=`, one-click reviewer accounts), `AuthProvider` with the CASL v7 `AbilityProvider` (ability built with the same `buildRules` as the backend), shell with ability-filtered nav, kitchen clock (server time, IST), sign-out, and a dashboard composed of the sections the ability allows. Verified in the browser: redirect → login → dashboard for kitchen/admin/driver; driver at phone width. Found and fixed: (1) admin was granted `dashboard.driver` and saw an always-empty "My deliveries", so the admin role now excludes driver views (TRD §5.5 updated, re-seeded, applied live without re-login); (2) shadcn wrote a self-referencing `--font-sans` (serif fallback), now pointing at Geist.
- 2026-10-03 06:00: T-206 done. Staff API (`GET /staff` paginated + search, `GET /roles`, `POST /staff`, `PATCH /staff/:id`, `POST /staff/:id/reset-password`) with token-version bumps on role change, deactivation and password reset, a self-lockout guard (no self-deactivate or self role change), and friendly duplicate-email field errors; the exception filter now maps Prisma P2002/P2025. 5 service tests. UI `/settings/staff`: table, search, pagination, create form (shared schema), inline role select, activate toggle, password reset; own row disabled. Verified on Neon (probe account created then deleted) and in the browser (admin works, kitchen sees the 403 page and no nav entry). Shared `paginationQuerySchema` / `Paginated<T>` added for all lists.
- 2026-10-03 06:10: T-207 + T-208 done. Settings API (GET/PATCH with the window check against stored values; kitchen holidays add/list/delete with duplicate and impossible-date checks; public-domain blocklist) and a generic reference-list API for the 5 lists (no DELETE by design; case-insensitive duplicate names; unknown list → 404). Seed adds the reference lists and 18 public domains. UI: `/settings` (weekday toggles, HH:mm times, timings, toggles, holidays, domains) and `/settings/reference` (tabs, inline rename, activate/deactivate; read-only for kitchen/dispatch). Verified: API probe (17 checks) and a browser save round-trip (Sunday off → saved → restored). The cut-off preview (FR-SET-04, Should) is deferred until the cut-off calculator lands in T-502.
- 2026-10-03 06:15: T-210 done. `backend/test/permission-matrix.test.ts` boots the real AppModule (fake Prisma) and checks 10 routes × 4 roles (+ anonymous 401). It also proves the boot check passes on the full app. Backend now has 62 tests.

## Outcome

P2 complete locally on 2026-10-03 06:15 (CP1 target 13:00).
- Built: permission catalogue + CASL rules from codes; idempotent seed (4 reviewer accounts); cookie JWT auth with throttled login; one global AccessGuard (revocation via tokenVersion) with a fail-closed boot check; money redaction; Origin check; frontend sign-in, ability-driven shell and dashboard sections; staff management; settings, kitchen holidays and public domains; reference lists; time helpers + ClockService.
- Deferred: FR-SET-04 cut-off preview (needs T-502).
- Outstanding exit criterion: "4 accounts sign in on the live app" waits on T-108 (Render).
