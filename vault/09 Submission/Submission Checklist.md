---
type: checklist
updated: 2026-10-03 01:45 IST
---

# 📦 Submission Checklist

Deadline **Sun 4 Oct 2026, 23:59 IST**. Target submission **22:30 IST** (CP6).

## A. Deliverables (from the brief)

- [ ] Live link works in a **private/incognito window**
- [ ] The four accounts sign in with `Test@1234`: admin@test.com, kitchen@test.com, dispatch@test.com, driver@test.com
- [ ] **Public** GitHub repo; clean history; no secrets; tag `v1.0.0`
- [ ] `README.md` has every section in [[README Outline]]
- [ ] Google Form submitted (record the time in [[STATUS]])
- [ ] Keep-alive monitor active; plan to keep the app live ≥ 2 weeks (T-1104)

## B. Live smoke test (run on production, ~20 min)

**Access**

- [ ] Each role sees only its own nav. Visiting another role's URL → 403 page
- [ ] `curl` an admin endpoint with the kitchen cookie → 403 (server-side enforcement)
- [ ] Driver API returns only driver@test.com's drops for today

**Data on "today"**

- [ ] Orders exist in every status: Draft, Placed, Confirmed, Delivered, Cancelled, Rejected
- [ ] Spread: past days, today, next 7 days
- [ ] Kitchen board for today has not-started units; dispatch board has drops at several stages
- [ ] driver@test.com has drops today, including out-for-delivery ones

**Flows**

- [ ] Create an order with 2 combinations (e.g. 6 + 4); see the breakdown; place it
- [ ] Try invalid input (sum mismatch, missing required group) → inline errors
- [ ] Edit before the cut-off works; a locked date refuses edits for non-admins
- [ ] Cut-off page: Run now on a passed date → counts; run again → 0/0
- [ ] Kitchen: start/done a unit; double "done" from two tabs → one gets a clear 409
- [ ] Dispatch: assign driver → dispatch-ready → out for delivery
- [ ] Driver (phone viewport): mark delivered with note + photo; on-time shown
- [ ] Billing: create an invoice for a company → total = Σ lines; mark paid; the same order can't be invoiced again
- [ ] Pricing: tier grid shows missing prices; derived price rounding (e.g. $2.11 → $2.15)
- [ ] Menu preview as a Startup-tier employee hides unpriced dishes; secret slug works
- [ ] Settings: change the cut-off time → lock times update
- [ ] Dashboards load for all 4 roles; figures look sane

**Robustness**

- [ ] API wakes from cold in < 1 min (should be warm thanks to the keep-alive)
- [ ] No console errors on the main screens

## C. Final repo checks

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` clean locally and in CI
- [ ] `.env*` files absent from git; `.env.example` present
- [ ] The vault is up to date (STATUS, Task Board, Requirements Matrix, Commit Log)
