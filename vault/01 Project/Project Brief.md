---
type: project
updated: 2026-10-03 01:30 IST
---

# 📋 Project Brief

> Paraphrased summary of the assignment. The original PDF is at `vault/_assets/hiring-assignment-admin-panel.pdf` (local only, git-ignored). The full, numbered requirements are in `docs/PRD.md`.

## The business

**Fernleaf Kitchen** (fictional) runs **corporate meal programs**. Client companies sign up; their employees order individual **boxed meals** for specific **delivery dates**; the kitchen cooks, packs and delivers to the company's office. **Employees never pay**: every order is billed to the employee's company.

We build the **internal admin panel** used by the kitchen's own staff. There is **no customer-facing app**: staff create orders on behalf of employees.

## Ground rules

- **Stack (mandatory):** Next.js frontend, NestJS backend, Prisma ORM. Database: anything Prisma supports (we use Postgres on Neon). Everything else is our choice, and every choice must be defensible.
- The frontend talks to the backend **over HTTP**. **No business logic in Next.js server actions** that bypass the API.
- Deploy anywhere (free tiers OK). It must stay **live for at least 2 weeks** after submission.
- **Four test accounts** with exact credentials, each limited to its role:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@test.com` | `Test@1234` |
| Kitchen | `kitchen@test.com` | `Test@1234` |
| Dispatch | `dispatch@test.com` | `Test@1234` |
| Driver | `driver@test.com` | `Test@1234` |

- **Realistic data must already exist**: several companies with employees, a real-looking menu, orders in **every status** across past dates, **today** and the coming week, and **deliveries for driver@test.com today**. "Today" is whichever day they review.
- The **data model is ours to design** and is a main evaluation area. AI tools are allowed, but every line must be explainable.
- Scope is deliberately larger than the time. **Prioritising is part of the test.**

## Roles (one role per staff member; admins create staff)

| Role | Day to day |
|---|---|
| Admin | Everything: catalogue, pricing, companies, employees, orders, overrides |
| Kitchen | What to cook; mark work started/done; read-only on what they need |
| Dispatch | Move cooked orders out, assign drivers, track delivery |
| Driver | Own deliveries for the day; mark delivered with note + optional photo |

Permissions are **enforced on the server**. Adding a role must not require hunting for role-name checks.

## Functional areas (all **Must** unless noted)

Catalogue (portions = **Should**) · Menu · Pricing · Companies · Employees (CSV import = **Should**) · Orders + cut-off · Kitchen board · Dispatch board + driver view · Company billing · Settings · Dashboards. The detailed list with IDs is in PRD §4 and the rules are in PRD §5.

## Out of scope (do not build; simulate)

Employee payments · multiple order types · customers without a company · free included options · date-based menus · pausing employees · exports · accounting integration · recipe/costing integration · promo codes · tax · delivery fees/zones · audit logs · customer app · emails/notifications (log to console) · marketing.

## Non-functional

Money without floating-point errors (totals reconcile) · a single kitchen time zone, correct regardless of the server or browser TZ, and stated · concurrency safety · server-side validation with actionable errors · server pagination; kitchen board fast at 400 orders · clean module boundaries, shared types, consistent errors, clean lint and typecheck · tests for **cut-off, pricing, combinations, invoicing**.

## Deliverables

1. **Live link** with the 4 accounts working.
2. **Git repo** (public), with a **clean commit history** they will read.
3. **README.md**:
   - local setup;
   - architecture overview and **data model diagram**;
   - key decisions and trade-offs;
   - **dashboard definitions** (what is shown and why, exact calculations, what is *not* shown);
   - **prioritisation** (built / skipped / why / next steps / ambiguities and interpretations).

## How it's evaluated

| Area | Looking for |
|---|---|
| Domain modelling | Model reflects the business; rules enforced; survives the next requirement |
| Correctness | Cut-offs, pricing, money, including edge cases |
| Product thinking | Dashboards, kitchen and dispatch boards, usability for real staff |
| Engineering quality | Structure, typing, error handling, tests, use of the stack |
| Judgement | Prioritisation, handling ambiguity, honesty about gaps |
| Communication | README and the state of the live app |

## Process notes from the emails

- Problem statement received **Sat 3 Oct 2026, 00:06 IST**. **Deadline Sun 4 Oct 2026, 23:59 IST.** Late submissions are not considered.
- Submit through the **Google Form**: live link + **public** repo link.
- Do the Musts properly before anything else. The README must state what was skipped and why.
- Ambiguity → make a sensible assumption and write it down. *How we handle ambiguity is evaluated.*
