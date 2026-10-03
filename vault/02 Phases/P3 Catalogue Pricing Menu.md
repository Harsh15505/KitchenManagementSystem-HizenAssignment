---
type: phase
id: P3
status: in-progress
estimate: 6h
target: CP2 Sat 3 Oct 21:00 IST (with P4)
---

# P3: Catalogue, pricing and menu

**Goal:** admins manage dishes, options and groups; tiers with derived prices and the whole-tier grid; menu categories/items with secret categories; the menu preview shows exactly an employee's menu.

Specs: PRD FR-CAT-*, FR-PRC-*, FR-MEN-*, BR-PRC-*, BR-MEN-*, A-05…A-13 · TRD §8.2, §8.4 · DATABASE_MODELS §3.3–3.5

## Tasks

- [x] **T-301** Catalogue schema (Dish, Option, OptionGroup, OptionGroupItem, OptionGroupPortionSize, OptionPortionPrice, joins) + migration + CHECKs.
- [ ] **T-302** Dishes API + UI: list (search, active, station filters, server pagination), create/edit (SKU unique, temperature, cost, allergens, tags, station, min qty, image URL), activate/deactivate (no delete), setup-gap badges.
- [ ] **T-303** Options API + UI (cost, allergens, tags); *(Should)* portion extra charges per size.
- [ ] **T-304** Option-group editor on the dish page: required, max selections, display order, ordered options; *(Should)* portions toggle + sizes with the support invariant (`PORTION_SIZE_UNSUPPORTED`).
- [x] **T-305** Pricing schema: PriceTier (derivation, factorBps, baseTierId), DishTierPrice/OptionTierPrice (NULL = excluded), `PlatformSettings.defaultPriceTierId`.
- [x] **T-306** `shared/domain/money.ts` (`divCeil`, `deriveCents`, `formatUsd`) + `pricing.ts` (`resolvePrice`, `employeeTierId`, cycle detection) + **tests BR-PRC-01…05** (211.2¢ → 215¢, etc.).
- [ ] **T-307** Tiers API + UI: create/edit derivation (×multiplier or ±%), make default, delete if unused, acyclic check.
- [ ] **T-308** Tier grid API + UI: dishes/options with explicit/derived/effective/source, "missing only", inline edit, set/exclude/clear, bulk save, missing counts.
- [x] **T-309** Menu schema: MenuCategory (slug, secret), MenuItem, CompanyHiddenCategory, CompanyHiddenMenuItem.
- [ ] **T-310** Menu management API + UI: categories and items CRUD, ordering (up/down), activate, secret flag.
- [ ] **T-311** `shared/domain/menu.ts` `resolveEmployeeMenu` + **tests BR-MEN-01…04** (hidden beats secret, unpriced dish absent, unpriced option not offered, empty required group hides the dish).
- [ ] **T-312** Menu preview API + UI: pick company → employee; listed menu with prices on their tier; allergen/diet badges; secret slug input.
- [ ] **T-313** Seed: reference lists, 6 stations, ~25 dishes (one without a station), ~25 options, groups (one portioned), 4 tiers (one incomplete), menu with 7 categories + secret `chefs-table` → [[Demo Data Plan]].

## Exit criteria

- [ ] The pricing tests pass (incl. rounding, overrides, exclusions, chains, cycle)
- [ ] The tier grid shows missing prices; the preview hides those dishes for that tier's companies
- [ ] The secret category is reachable only by slug

## Log

- 2026-10-03 06:20: T-301/T-305/T-309 (catalogue, pricing and menu tables) were already created by the T-104 migration from DATABASE_MODELS §4, so they are marked done.
- 2026-10-03 06:25: T-306 done. `shared/src/domain/pricing.ts`: `resolvePrice` (explicit > MANUAL-missing > FROM_COST / FROM_TIER with ceil5; exclusions; dish > 0, option ≥ 0; unknown tier → missing), `effectiveTierId`, `findDerivationCycle`, `pricingContext`. 15 tests named BR-PRC-01…05 incl. the brief example ($2.11 → $2.15), chains, overrides, exclusions, no per-item fallback, loops.

## Outcome
