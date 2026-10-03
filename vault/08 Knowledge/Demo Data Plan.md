---
type: reference
updated: 2026-10-03 18:55 IST
---

# 🌱 Demo Data Plan

Goal: when a reviewer opens the live app **on any day and at any hour**, every screen has believable data and every role has something to do (FR-DAT-01..04, ADR-017). Prices are **USD**. Names are Indian (the kitchen is in India, IST). Domains use the reserved `.example` TLD, so no real company is impersonated.

> **As built (2026-10-03):** 27 dishes, 17 options, 4 tiers, 7 categories + secret `chefs-table`, 5 companies, 60 employees (static seed, idempotent). Rolling window −14…+7 days built through the real menu/combination/pricing functions (first run 702 orders, 113 drops); autopilot advances today's demo orders up to per-drop caps; weekly invoices for delivered demo orders older than 7 days. Details: README §12, [[P10 Demo Data and Deploy]].

## Staff (password for the 4 reviewer accounts: `Test@1234`)

| Name | Email | Role | Notes |
|---|---|---|---|
| Asha Rao | admin@test.com | admin | |
| Vikram Nair | kitchen@test.com | kitchen | kitchen lead |
| Neha Kapoor | dispatch@test.com | dispatch | |
| Ravi Kumar | driver@test.com | driver | **default driver of the 7-day companies + Lumen Labs**, so drops every day |
| Imran Shaikh | imran.driver@fernleaf.example | driver | extra driver |
| Deepa Menon | deepa.driver@fernleaf.example | driver | extra driver |
| Sunita Das | sunita.cook@fernleaf.example | kitchen | extra cook |

Extra staff use a random password (not documented); only the 4 test accounts are for reviewers.

## Settings

Kitchen TZ Asia/Kolkata · **kitchen works Mon–Sun** (A-02) · cut-off **2 kitchen working days at 16:00** · kitchen buffer 30 min · at-risk window 30 min · on-time grace 5 min · delivery window 07:00–21:00 in 15-min slots · default dispatch lead 60 min · one kitchen holiday about 5 weeks out (Diwali; verify the date) so it's visible in Settings without emptying the review window.

## Reference lists

- **Allergens:** Milk/Dairy, Gluten, Peanuts, Tree nuts, Soy, Sesame, Mustard, Egg, Shellfish, Fish
- **Dietary tags:** Vegetarian, Vegan, Jain, Gluten-free, Dairy-free, High-protein
- **Stations:** Tandoor, Curry & Dal, Grill, Cold Kitchen, Pastry, Beverages
- **Portion sizes:** Regular, Large
- **Packaging:** Compostable Box, Insulated Bag, Bento Box, Bulk Crate

## Catalogue (about 25 dishes, cost price in USD → Standard = cost × 2.4, ceil 5¢)

| Category | Dishes (station) | Notes |
|---|---|---|
| Bowls | Paneer Tikka Rice Bowl (Tandoor), Chole Rice Bowl (Curry), Rajma Chawal Bowl (Curry), Grilled Chicken Bowl (Grill), Thai Green Curry Bowl (Curry) | groups: **Choose your protein** (req: paneer/tofu/chickpeas), **Choose your rice** (req, **portioned** Regular/Large: jeera/brown/millet), **Add sides** (optional, max 2: raita, mint chutney, mango pickle) |
| Wraps & Rolls | Paneer Kathi Roll (Tandoor), Falafel Wrap (Grill), Chicken Shawarma Wrap (Grill) | bread choice (whole-wheat/missi) |
| Thalis | Mini Veg Thali (Curry), **Jain Thali** (Curry, Jain-tagged), South Indian Meal (Curry) | |
| Salads | Quinoa Kachumber Salad (Cold), Sprouts Chaat Salad (Cold) | COLD temperature |
| Breakfast | Masala Oats (Curry), Poha (Curry), Idli Sambar (Curry), Avocado Toast (Cold) | early delivery slots |
| Desserts | Gulab Jamun ×2 (Pastry), Mango Shrikhand (Cold), Ragi Brownie (Pastry) | |
| Beverages | Masala Chai (Beverages, HOT), Cold Coffee (Beverages, COLD), Fresh Lime Soda (Beverages, COLD) | milk choice: dairy/oat |
| **Chef's Table** (**secret**, slug `chefs-table`) | Truffle Mushroom Khichdi (Curry), Lamb Rogan Josh Bowl (Curry) | reachable only by slug |
| — (no station) | **Seasonal Fruit Cup** | → "Unassigned" on the kitchen board |
| Min order qty | **Samosa Snack Box** (min 2) | demonstrates BR-CMB-05 |

Options: Paneer, Tofu, Chickpeas, Grilled Chicken, Jeera Rice, Brown Rice, Millet, Raita, Mint Chutney, Mango Pickle, Whole-wheat Roti, Missi Roti, Dairy Milk, Oat Milk, Extra Papad… each with cost, allergens and tags.

## Price tiers

| Tier | Rule | Purpose |
|---|---|---|
| **Standard** (default) | FROM_COST × 2.4, a few overrides | shows derivation + overrides |
| **Enterprise** | FROM_TIER Standard −10 % (9000 bps) | chain derivation |
| **Partner** | FROM_TIER Standard +15 % (11500 bps) | the brief's example |
| **Startup** | MANUAL, only ~60 % of dishes priced | **missing prices → hidden dishes**, the grid's "missing" filter |

## Companies (domains `.example`)

| Company | Domains | Tier | Calendar | Default time | Lead | Default driver | Special |
|---|---|---|---|---|---|---|---|
| **Lumen Labs** | lumenlabs.example | Enterprise | Mon–Fri | 12:30 | 60 | driver@test.com | 2 addresses (HQ, Annex); hides Desserts |
| **Northwind Traders** | northwind.example, nwtraders.example | none → Standard | Mon–Fri | 13:00 | 45 | Imran | company holiday next week |
| **Kestrel Fintech** | kestrel.example | Partner | **Tue–Thu** (hybrid office) | 12:45 | 60 | Deepa | hides one item |
| **Orbit Health** (hospital) | orbithealth.example | Standard | **Mon–Sun** | 08:30 (+ staff can pick 13:00) | 60 | **driver@test.com** | breakfast + lunch; 3 shifts |
| **Saffron Studio** | saffronstudio.example | **Startup** | **Mon–Sun** (24×7 support centre) | 19:30 | 90 | **driver@test.com** | missing prices hide dishes |

Each company: billing contact, owner employee, default packaging, driver instructions ("Reception on 3F, ask for the pantry lead").

## Employees (~60)

10–15 per company, names like Priya Sharma, Arjun Mehta, Kavya Iyer, Rohan Gupta, Ananya Reddy, Farhan Ali, Meera Pillai… Email `first.last@<domain>`. Mixed flags (about 30 % can choose address, 20 % can change time, 25 % packaging). Allergies on about 25 % (peanuts, dairy, gluten, sesame). Preferences (vegan, Jain, gluten-free). One inactive employee per company.

## Orders: rolling window (generated, `source = DEMO`)

| Window part | Statuses (≈) | Extras |
|---|---|---|
| Past 14 days | Delivered 92 %, Cancelled 5 %, Rejected 3 % | kitchen/dispatch timestamps consistent with the plans; on-time ≈ 85 %; a few shortages (credits) |
| **Today** | Confirmed, with autopilot caps: 40 % → DELIVERED, 15 % → OUT_FOR_DELIVERY, 15 % → DISPATCH_READY, 15 % → KITCHEN_READY, 15 % manual | driver@test.com drops at several times of day |
| Future, cut-off passed (≈ next 2 days) | Confirmed (drops assigned) | |
| Future, still open (≈ days 3–7) | Placed 75 %, Draft 20 %, Cancelled 5 % | the next cut-off visibly converts them |
| Billing | weekly invoices per company for delivered orders older than 7 days: older ones **Paid**, the latest **Issued**; the last 7 days **uninvoiced** | one cancellation credit pending |

Volume: about 40–70 orders per weekday, 10–20 on weekends (only the 7-day companies). Lines: 1–3 per order; 70 % single combination; some multi-combination lines (e.g. 3 bowls = 2 brown + 1 jeera).
