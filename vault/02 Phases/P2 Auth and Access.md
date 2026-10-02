---
type: phase
id: P2
status: not-started
estimate: 3h
target: CP1 Sat 3 Oct 13:00 IST
---

# P2: Auth, access, staff and settings

**Goal:** the four test accounts sign in. Every API route is permission-guarded (fail-closed). The UI shell is permission-driven. Settings, reference data and the clock exist.

Specs: PRD FR-ACC-*, FR-SET-*, BR-ACC-* · TRD §5.3–5.5, §5.8 · ADR-003, ADR-004, ADR-006, ADR-023

## Tasks

- [ ] **T-201** Permission catalogue + default role mapping in `@fernleaf/shared/permissions`, plus **CASL rules** `buildRules(user)` in `@fernleaf/shared/authz` (TRD §5.5) with unit tests of each seeded role's abilities; ESLint rule against role-name literals outside seeds.
- [ ] **T-202** Seed (idempotent): roles with permissions; the **4 test accounts with `Test@1234`** + 2 extra drivers + 1 extra cook; settings singleton (kitchen 7 days, cut-off 2 days at 16:00); the default tier (placeholder until P3).
- [ ] **T-203** Auth module: `POST /auth/login` (throttled, generic errors), `POST /auth/logout`, `GET /auth/me`; JWT in the `fl_session` cookie (HttpOnly, Secure, SameSite=Lax, no Domain); `tokenVersion`; Origin check on mutations.
- [ ] **T-204** Global `AuthGuard` + CASL `AbilityFactory` (`createPrismaAbility` through the `@casl/prisma/runtime` wrapper for Prisma 7) + `PoliciesGuard` / `@CheckPolicies` + `@Public` + a boot-time check that every route is decorated; `@CurrentUser`; `MoneyRedactionInterceptor` (strip `*Cents` when `ability.cannot('read', 'Money')`).
- [ ] **T-205** Frontend: login page (demo-account hints), `MeProvider` + CASL `AbilityProvider` (`buildRules` from the `/auth/me` codes), `<Can>` / `useAbility`, nav config filtered by ability, `RequireAbility` page guard, 403/404 pages, kitchen clock (IST) in the top bar; `/dashboard` placeholder sections per dashboard ability.
- [ ] **T-206** Staff management API + UI: list, create (role, initial password), change role, deactivate (bumps tokenVersion), reset password.
- [ ] **T-207** Settings API + UI: platform values, kitchen working days, kitchen holidays, public-domain blocklist, toggles; *(Should)* cut-off preview.
- [ ] **T-208** Reference data API + UI: allergens, dietary tags, kitchen stations, portion sizes, packaging types (deactivate if in use).
- [ ] **T-209** `ClockService` + `shared/domain/time.ts` (CalendarDate, `toInstant`, `toKitchenDate`, `addDays`, `isoWeekday`, `toDbDate`/`fromDbDate`) + TZ-matrix tests; `GET /meta/clock`.
- [ ] **T-210** Integration test: permission matrix (each seeded role × representative routes → 200/403); the driver can't list orders; the kitchen gets no `*Cents` fields.

## Exit criteria

- [ ] Each of the 4 accounts signs in **on the live app** and sees only its nav
- [ ] Direct API calls outside the role → 403 (verified by T-210)
- [ ] Settings editable in the UI (no DB edits)

## Log

## Outcome
