---
type: phase
id: P4
status: not-started
estimate: 3h
target: CP2 Sat 3 Oct 21:00 IST
---

# P4: Companies and employees

**Goal:** admins set up client companies completely (domains, addresses, billing, owner, calendar, delivery defaults, tier, hidden menu) and their employees (flags, allergies, preferences, moves).

Specs: PRD FR-CMP-*, FR-EMP-*, BR-CMP-*, BR-EMP-*, A-21, A-26…A-30 · DATABASE_MODELS §3.6

## Tasks

- [ ] **T-401** Schema: Company (owner FK unique, default address FK unique), CompanyDomain (global unique), CompanyAddress, CompanyHoliday, Employee + EmployeeAllergy + EmployeeDietaryPreference; migration + CHECKs.
- [ ] **T-402** Companies API + UI: list; **create in one TX** (company + owner employee + first domain + first address = default); edit billing, tier, delivery defaults (time, lead minutes, packaging, instructions, default driver = a user with `delivery.perform`).
- [ ] **T-403** Domains (lower-case, valid host, unique, not public → `PUBLIC_EMAIL_DOMAIN` / `DOMAIN_TAKEN`), addresses (make default, archive), calendar (working days, holidays); *(Should)* holiday conflict warning with the affected orders.
- [ ] **T-404** Company menu visibility UI: tree of categories → items with hide toggles.
- [ ] **T-405** Employees API + UI: list per company and global search; create/edit (email domain ∈ company domains, flags, allergies, preferences, active); **move** to another company (new email on that company's domain; owner guard `OWNER_CANNOT_MOVE`); transfer ownership.
- [ ] **T-406** *(Should)* CSV import: template download; per-row validation; create the valid rows; report `{row, column, message}` for the rest.
- [ ] **T-407** Seed: 5 companies with mixed calendars, tiers, hidden items, holidays and drivers; ~60 employees → [[Demo Data Plan]].
- [ ] **T-408** Tests: domain rules (public, unique, case), employee domain check, owner move guard, create-company TX atomicity.

## Exit criteria

- [ ] A company can't exist without owner + default address (seed integrity test)
- [ ] Menu preview reflects company tier + hiding

## Log

## Outcome
