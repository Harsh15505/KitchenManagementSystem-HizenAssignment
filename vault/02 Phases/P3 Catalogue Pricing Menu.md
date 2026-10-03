---
type: phase
id: P3
status: done
estimate: 6h
target: CP2 Sat 3 Oct 21:00 IST (with P4)
---

# P3: Catalogue, pricing and menu

**Goal:** admins manage dishes, options and groups; tiers with derived prices and the whole-tier grid; menu categories/items with secret categories; the menu preview shows exactly an employee's menu.

Specs: PRD FR-CAT-*, FR-PRC-*, FR-MEN-*, BR-PRC-*, BR-MEN-*, A-05…A-13 · TRD §8.2, §8.4 · DATABASE_MODELS §3.3–3.5

## Tasks

- [x] **T-301** Catalogue schema (Dish, Option, OptionGroup, OptionGroupItem, OptionGroupPortionSize, OptionPortionPrice, joins) + migration + CHECKs.
- [x] **T-302** Dishes API + UI: list (search, active, station filters, server pagination), create/edit (SKU unique, temperature, cost, allergens, tags, station, min qty, image URL), activate/deactivate (no delete), setup-gap badges.
- [x] **T-303** Options API + UI (cost, allergens, tags); *(Should)* portion extra charges per size.
- [x] **T-304** Option-group editor on the dish page: required, max selections, display order, ordered options; *(Should)* portions toggle + sizes with the support invariant (`PORTION_SIZE_UNSUPPORTED`).
- [x] **T-305** Pricing schema: PriceTier (derivation, factorBps, baseTierId), DishTierPrice/OptionTierPrice (NULL = excluded), `PlatformSettings.defaultPriceTierId`.
- [x] **T-306** `shared/domain/money.ts` (`divCeil`, `deriveCents`, `formatUsd`) + `pricing.ts` (`resolvePrice`, `employeeTierId`, cycle detection) + **tests BR-PRC-01…05** (211.2¢ → 215¢, etc.).
- [x] **T-307** Tiers API + UI: create/edit derivation (×multiplier or ±%), make default, delete if unused, acyclic check.
- [x] **T-308** Tier grid API + UI: dishes/options with explicit/derived/effective/source, "missing only", inline edit, set/exclude/clear, bulk save, missing counts.
- [x] **T-309** Menu schema: MenuCategory (slug, secret), MenuItem, CompanyHiddenCategory, CompanyHiddenMenuItem.
- [x] **T-310** Menu management API + UI: categories and items CRUD, ordering (up/down), activate, secret flag.
- [x] **T-311** `shared/domain/menu.ts` `resolveEmployeeMenu` + **tests BR-MEN-01…04** (hidden beats secret, unpriced dish absent, unpriced option not offered, empty required group hides the dish).
- [x] **T-312** Menu preview API + UI: pick company → employee; listed menu with prices on their tier; allergen/diet badges; secret slug input.
- [x] **T-313** Seed: reference lists, 6 stations, ~25 dishes (one without a station), ~25 options, groups (one portioned), 4 tiers (one incomplete), menu with 7 categories + secret `chefs-table` → [[Demo Data Plan]].

## Exit criteria

- [ ] The pricing tests pass (incl. rounding, overrides, exclusions, chains, cycle)
- [ ] The tier grid shows missing prices; the preview hides those dishes for that tier's companies
- [ ] The secret category is reachable only by slug

## Log

- 2026-10-03 06:20: T-301/T-305/T-309 (catalogue, pricing and menu tables) were already created by the T-104 migration from DATABASE_MODELS §4, so they are marked done.
- 2026-10-03 06:25: T-306 done. `shared/src/domain/pricing.ts`: `resolvePrice` (explicit > MANUAL-missing > FROM_COST / FROM_TIER with ceil5; exclusions; dish > 0, option ≥ 0; unknown tier → missing), `effectiveTierId`, `findDerivationCycle`, `pricingContext`. 15 tests named BR-PRC-01…05 incl. the brief example ($2.11 → $2.15), chains, overrides, exclusions, no per-item fallback, loops.
- 2026-10-03 06:35: T-311 done. `shared/src/domain/menu.ts`: `resolveEmployeeMenu(input, access)` (listed / one secret slug / all) and `orderableDishes` for order validation (same function, BR-MEN-04). Rules: active category/item/dish; company hiding (category hides items, hiding beats secret); dish priced on the tier; options active + priced + supporting every size of a portioned group; a required group with no offer hides the dish; empty optional groups are dropped; allergen conflicts and diet matches per employee. 12 tests.
- 2026-10-03 06:13: Catalogue API (backend half of T-302/303/304): dishes (list/search/filter, detail, create, update incl. allergen/tag replacement, deactivate via PATCH, no delete), options (portion extras per size), option groups (create/update/delete/reorder). Portion invariant as a pure `portionViolations` (3 tests), enforced on group create/update and when an option drops a size. `parseUsd`/`centsToInput` (string-based, no floats; 3 tests). Probe on Neon: 13 checks green, probe data deleted. UI next.
- 2026-10-03 06:30: Catalogue UI (T-302/303/304 done). Dishes list (search, status, station filters, pagination, setup-gap badges), dish page (create/edit/deactivate, cost via string-parsed `MoneyInput`, allergen/tag chips) with the option-group editor (required, max, sizes, ordered options, reorder, remove), options page (create/edit/deactivate, size extras). Nav: Dishes, Options (`read Catalogue`). Read-only for kitchen; money columns hidden without `read Money`. Browser check found BUG-003 (partial PATCH reset fields; fixed in shared with tests) and BUG-004 (redacted cents crashed the lists; fixed before commit). Probe rows deleted.
- 2026-10-03 06:40: T-307 + T-308 done. Pricing module: tier list with rule, default flag, company count and missing dish/option counts; create/edit (derivation shape validated in `priceTierInputSchema`, cycle refused with `TIER_CYCLE` via `findDerivationCycle`); make-default (one settings update); delete refused when default, used by companies, a base for other tiers or used by orders. Grid per tier and kind: cost, base price, derived, typed entry, effective, source; search + missing only; bulk set/exclude/clear in one transaction (dish price > 0). Factors typed as `2.4` or `-10` and parsed to bps without floats (`multiplierToBps`, `percentToBps`; tests). UI: `/pricing`, `/pricing/[tierId]` with dirty-cell drafts and a preview. ADR-026: plain table, no TanStack Table, for the grid. Neon probe 20 checks + browser check green; probe rows deleted.
- 2026-10-03 06:45: T-310 done. Menu module: categories (name, slug, description, secret, active; unique name/slug), ordered via `PUT /menu/categories/order`; items place a dish once per category, ordered, activatable, removable; delete category cascades items and company hiding. Each item flags `unpricedOnDefaultTier`. UI `/menu`: category cards with badges (secret, inactive, hidden for N companies), slug follows the name until edited, add-dish picker, up/down, active toggles. BUG-005 caught in the probe (excluded dishes weren't flagged). Probe rows deleted.
- 2026-10-03 06:50: T-313 done. `backend/prisma/seed/catalogue.ts`: 17 options (rice options with Regular/Large extras), 27 dishes per the Demo Data Plan (portioned rice group on bowls, bread/milk/sides groups, Seasonal Fruit Cup without a station, Samosa Snack Box min 2), tiers Enterprise (Standard −10 %, lamb special excluded), Partner (+15 %), Startup (manual, 17 of 27 dishes and every option except Grilled Chicken priced), Standard overrides ($4.95, $0.99, $1.29, as typed), 7 listed categories + secret `chefs-table`. Create-if-missing only (`update: {}`), so admin edits survive re-seeding; ran twice on Neon, no duplicates. Note: the Wraps & Rolls category also holds the Samosa Snack Box.
- 2026-10-03 07:12: T-312 done, **P3 complete**. `MenuInputService.forEmployee` loads categories, dishes with groups, options with size extras, company hiding, the effective tier and the pricing context (`PricingService.loadContext`) into one `MenuInput`; P5 order validation will reuse it (BR-MEN-04). Endpoints `GET /menu/for-employee/:id` and `…/secret/:slug` (menu.read or orders.create). UI `/menu/preview`: company → employee → optional slug; prices on their tier, allergen warnings on dishes and options, diet matches. Verified on seeded data: Lumen hides Desserts and gets Enterprise prices ($3.80 bowl); Kestrel loses Cold Coffee; Saffron (Startup) sees only priced dishes; Chef's Table opens by slug (case-insensitive) and drops the lamb on Enterprise. Also: nav highlights only the most specific item.

## Outcome
