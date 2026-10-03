---
type: reference
updated: 2026-10-03 18:47 IST
---

# 📖 Glossary

| Term | Meaning in this project |
|---|---|
| **Staff** | A user of the admin panel (signs in). Has exactly one **role** |
| **Employee** | A customer: an employee of a client company. **Never signs in**. Staff order for them |
| **Company** | A client organisation. Has domains, addresses, calendar, delivery defaults, a price tier and an owner |
| **Owner** | The company's designated employee (must belong to that company) |
| **Email domain** | A domain a company claims (e.g. `lumenlabs.example`). Unique across companies; never public (gmail.com…) |
| **Role / permission code** | A role is a DB record holding permission codes (`orders.create`). Code checks abilities built from the codes, never role names |
| **Ability (CASL)** | What a user may attempt, built from their role's permission codes by `buildRules()`. Checked by `PoliciesGuard` (routes), `accessibleBy` (rows) and `<Can>` (UI) |
| **Dish** | A sellable item with SKU, temperature, cost, allergens, dietary tags, station, optional min qty. Never deleted |
| **Option** | A reusable choice (paneer, jeera rice) with its own cost, allergens and tags |
| **Option group** | A dish's question ("Choose your protein"): required/optional, max selections, ordered options |
| **Portion / size** | Regular, Large… A portioned group sells options in sizes with an extra charge per option and size |
| **Combination** | One distinct set of choices for a dish, with a quantity. Quantities on a line sum to the line quantity |
| **Signature** | A canonical string identifying a combination's choices; used to merge duplicates and keep combinations distinct |
| **Prep unit** | What the kitchen works on = one combination on one order line. Started/done individually |
| **Station** | A kitchen area (Tandoor, Curry…). A dish with no station routes to **Unassigned** |
| **Menu category / item** | A category groups items. An item is a dish *placed* in a category (a dish can have several placements) |
| **Secret category** | Not listed, but reachable by its slug (`chefs-table`) |
| **Hidden** | Per-company hiding of a category or item. Beats secret |
| **Price tier** | A named price list (Standard, Enterprise…). Exactly one is the **default** |
| **Derived tier** | A tier whose prices derive from cost × factor or another tier × factor, rounded **up to the next 5 cents** |
| **Override / exclusion** | An explicit price on a derived tier / an explicit "not sold on this tier" |
| **ceil5** | Round up to the next multiple of 5 cents, done with integer arithmetic |
| **Captured price** | A price stored on the order combination when added; never changes afterwards |
| **Snapshot** | Copied names, SKU or address on order rows so later catalogue edits don't rewrite history |
| **Delivery date** | A kitchen-local calendar date (IST). Must be deliverable for the company **and** the kitchen |
| **Kitchen working day** | A weekday in settings and not a kitchen holiday. Used to count cut-off days |
| **Cut-off** | The lock instant for a delivery date: the cut-off time on the Nth kitchen working day before |
| **Locked** | `now ≥ cutoffAt`. Non-admins can't change orders for that date |
| **Cut-off processing** | At or after the cut-off: drafts → Cancelled, placed → Confirmed (billable). Idempotent and logged (`CutoffRun`) |
| **Late order** | An admin order created after the cut-off; goes straight to Confirmed |
| **Statuses** | Draft → Placed → Confirmed → Delivered, plus Cancelled and Rejected |
| **Fulfilment stage** | Within Confirmed: Queued → In prep → Kitchen ready → Dispatch ready → Out for delivery → Delivered |
| **Planned dispatch-ready** | Delivery time − company **dispatch lead minutes** (default 60) |
| **Planned kitchen-ready** | Planned dispatch-ready − **kitchen buffer** (30 min setting) |
| **Late / at risk** | Not done and past the planned time / not done and within the at-risk window before it |
| **Drop** | Confirmed orders with the same company + address + exact delivery time; handled together, one driver |
| **On time** | A drop delivered at or before the scheduled time + grace (5 min setting) |
| **Billable** | Status Confirmed or Delivered; owed in full by the company |
| **Invoice** | An internal record for one company; lines = orders and adjustments; Issued → Paid; immutable |
| **Adjustment** | A money correction after confirmation (credit for cancelling an invoiced order, a shortage, or manual); billed on the next invoice |
| **Shortage** | A delivered order turned out short; the admin records the short quantity per combination |
| **Money redaction** | The API strips `*Cents` fields for users without `money.read` |
| **Demo window** | Rolling generated data from today−14 to today+7; one `DemoDay` row per generated date |
| **Autopilot** | Demo-only: advances seeded orders through kitchen and dispatch with the clock, up to a per-order cap |
| **Catch-up** | Idempotent job run on bootstrap and on (throttled) requests to process anything the timers missed |
| **Do not cook** | A kitchen card for an order cancelled or rejected after work started: shown so the cook stops, never counted as work |
| **Neon branch** | A copy-on-write copy of the database. Production and local dev share one (ADR-029); bulk test scripts use a throwaway branch |
| **Code freeze** | Sun 4 Oct 20:00 IST: no feature pushes after it, because every push redeploys the live app |
