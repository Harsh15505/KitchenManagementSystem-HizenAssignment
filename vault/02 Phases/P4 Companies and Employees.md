---
type: phase
id: P4
status: in-progress (T-406 deferred)
estimate: 3h
target: CP2 Sat 3 Oct 21:00 IST
---

# P4: Companies and employees

**Goal:** admins set up client companies completely (domains, addresses, billing, owner, calendar, delivery defaults, tier, hidden menu) and their employees (flags, allergies, preferences, moves).

Specs: PRD FR-CMP-*, FR-EMP-*, BR-CMP-*, BR-EMP-*, A-21, A-26…A-30 · DATABASE_MODELS §3.6

## Tasks

- [x] **T-401** Schema: Company (owner FK unique, default address FK unique), CompanyDomain (global unique), CompanyAddress, CompanyHoliday, Employee + EmployeeAllergy + EmployeeDietaryPreference; migration + CHECKs.
- [x] **T-402** Companies API + UI: list; **create in one TX** (company + owner employee + first domain + first address = default); edit billing, tier, delivery defaults (time, lead minutes, packaging, instructions, default driver = a user with `delivery.perform`).
- [x] **T-403** Domains (lower-case, valid host, unique, not public → `PUBLIC_EMAIL_DOMAIN` / `DOMAIN_TAKEN`), addresses (make default, archive), calendar (working days, holidays); *(Should)* holiday conflict warning with the affected orders.
- [x] **T-404** Company menu visibility UI: tree of categories → items with hide toggles.
- [x] **T-405** Employees API + UI: list per company and global search; create/edit (email domain ∈ company domains, flags, allergies, preferences, active); **move** to another company (new email on that company's domain; owner guard `OWNER_CANNOT_MOVE`); transfer ownership.
- [ ] **T-406** *(Should)* CSV import: template download; per-row validation; create the valid rows; report `{row, column, message}` for the rest.
- [x] **T-407** Seed: 5 companies with mixed calendars, tiers, hidden items, holidays and drivers; ~60 employees → [[Demo Data Plan]].
- [x] **T-408** Tests: domain rules (public, unique, case), employee domain check, owner move guard, create-company TX atomicity.

## Exit criteria

- [ ] A company can't exist without owner + default address (seed integrity test)
- [ ] Menu preview reflects company tier + hiding

## Log

- 2026-10-03 07:06: P4 Musts done. T-401 came with the init migration. Shared: `domain/company.ts` (`domainProblem`, `domainRemovalProblem`, `emailOnCompanyDomain`; 6 tests) and contracts for companies/employees (no defaults, see BUG-003). Backend `companies` module: create company + owner + first domain + default address in one interactive transaction (checks run before it opens); edit settings (tier, billing, calendar, delivery defaults; driver must hold `delivery.perform`); domains (public/taken refused; last or in-use domain kept); addresses (archive, default; default can't be archived); holidays; menu visibility (replace in one TX); employees (list/search, create/edit with domain check, deactivating the owner refused, move with the owner guard, make-owner). UI: `/companies`, `/companies/new`, `/companies/[id]` (settings, domains, holidays, addresses, menu visibility, employees with add/edit/move/make owner), `/employees`. Seed: 5 companies and 60 employees per the Demo Data Plan (fixed holiday dates 2026-10-09 and 2026-10-20 so re-seeding never piles up). Neon probe 24 checks + browser check green. Deferred: T-406 CSV import and the FR-CMP-05 holiday warning (needs orders).

## Outcome
