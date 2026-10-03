# Fernleaf Kitchen Ops — Technical Requirements Document (TRD)

| | |
|---|---|
| **Version** | 1.1 (2026-10-03): `frontend/` + `backend/` + `shared/` layout (ADR-022), CASL authorisation (ADR-023). 1.0 was the planning baseline |
| **Scope** | How we build what the [PRD](./PRD.md) specifies: stack, structure, API, algorithms, testing, deployment and operations |
| **Companion docs** | [PRD](./PRD.md) · [Database models](./DATABASE_MODELS.md) · [Architecture](./ARCHITECTURE.md) |
| **Decision history** | `vault/05 Decisions/Decision Log.md` (ADR-001…) |
| **Confirmed with owner** | Hosting = Vercel + Render + Neon · one repo with **`frontend/` + `backend/` + `shared/`** (pnpm workspaces, no Turborepo) · **RBAC = CASL abilities built from permission codes** · shadcn/ui + Tailwind · vault committed · **TZ = Asia/Kolkata (IST)** · **currency = USD, integer cents (as in the brief)** |

---

## 1. Purpose and constraints

**Mandatory stack (from the brief):** Next.js frontend, NestJS backend, Prisma ORM, any database Prisma supports.

**Hard constraints we design around:**

1. The **frontend talks to the backend over HTTP only**. Next.js holds no business logic, has no server actions that touch data, and has no direct DB access.
2. **Permissions are enforced on the server.** Hiding UI is cosmetic.
3. **Every rule is validated on the server.** The client may pre-validate for UX.
4. **Money**: integer cents; totals reconcile.
5. **Time**: one kitchen time zone (Asia/Kolkata), independent of the server's and browser's TZ.
6. **Concurrency-safe** mutations.
7. **Lint and type-check clean**, with tests for cut-off, pricing, combinations and invoicing.
8. **Live for at least two weeks** on free tiers (Vercel, Render, Neon), with fresh data every day.

---

## 2. Technology stack

> **Version policy:** use the latest **stable** release of each major listed here at scaffold time (P1), then pin exact versions in the lockfile. Record the resolved versions in `vault/08 Knowledge/Tech Stack.md`.

| Layer | Choice | Why (defensible in review) |
|---|---|---|
| Runtime | **Node.js 22 LTS** (local 22.13.1) | Supported by Next 16, Nest 11 and Prisma 7. Same major everywhere (`.nvmrc`, `engines`) |
| Package manager / repo | **pnpm 10 workspaces**: `frontend/`, `backend/`, `shared/` in one repo (no Turborepo) | One install and one lockfile. Both apps import `@fernleaf/shared`. `pnpm -r <script>` runs across packages in dependency order (shared first). A task runner would only add caching we don't need at this size |
| Language | **TypeScript (strict)** | Shared types end to end. `noUncheckedIndexedAccess` on |
| Frontend | **Next.js 16 (App Router)** + React 19 | Mandated. App Router layouts suit a role-based shell. **`proxy.ts`** replaces `middleware.ts` in v16 |
| UI kit | **shadcn/ui + Tailwind CSS 4** + lucide icons + sonner toasts | We own the component code, it's accessible (Base UI primitives: shadcn's current `base-nova` default, ADR-025), and it's fast to build admin UIs with |
| Data grid | **TanStack Table 8** | Server-side pagination, sorting and filtering on the order list (the tier grid is a plain table over one whole-tier response, ADR-026) |
| Server state | **TanStack Query 5** | Caching, polling for the boards, optimistic updates with rollback on 409 |
| Forms | **React Hook Form 7 + Zod 4** (`@hookform/resolvers` ≥ 5) | Uses the **same Zod schemas** as the API. Server errors map onto fields |
| Dates | **date-fns 4 + @date-fns/tz** | Explicit time-zone math (`TZDate`), tree-shakable, works in both apps |
| Backend | **NestJS 11** (Express 5 adapter) | Mandated. Modules give clear boundaries; guards, pipes and filters give consistent cross-cutting concerns |
| Validation (API) | **Zod 4 + nestjs-zod 5** (`createZodDto`, `ZodValidationPipe`) | One schema per contract, shared with the frontend. No class-validator duplication |
| Auth | **@nestjs/jwt + cookie-parser + bcryptjs**; **@nestjs/throttler** on login | Simple, auditable, no third-party identity provider. Pure-JS hashing, so no native build issues on Render |
| Authorisation | **CASL**: `@casl/ability` (shared rules), `@casl/prisma` (row filters, through its Prisma 7 runtime wrapper), `@casl/react` (`<Can>`) | Owner's choice, based on prior experience. Abilities are **built from the role's permission codes**, never from role names, so roles stay data. One rules file serves both backend and frontend |
| Scheduling | `@nestjs/schedule` (`SchedulerRegistry`, timeouts) + our own catch-up service | Precise timers instead of polling, to protect Neon's compute budget (§5.10) |
| ORM | **Prisma 7**: `prisma-client` generator (`moduleFormat = "cjs"`), `@prisma/adapter-pg`, `prisma.config.ts` | Mandated. Pin `prisma@^7` explicitly |
| Database | **PostgreSQL 17 on Neon** (Singapore) | Free tier, branching (dev/test), Prisma-friendly. CHECK constraints, advisory locks, `updateManyAndReturn` |
| Testing | **Vitest** (all packages; `unplugin-swc` for Nest decorators) + supertest for API integration | One runner. Fast pure-domain tests |
| Lint / format | **ESLint 9 flat config + typescript-eslint**, **Prettier** | "The repo must lint and type-check cleanly" |
| CI | **GitHub Actions** | lint · typecheck · test (TZ matrix) · build on every push and PR |
| Hosting | **Vercel** (web) · **Render free web service** (API, Singapore) · **Neon free** (DB, Singapore) · **UptimeRobot** keep-alive | Chosen with the owner. Free, close to IST users, API is long-running so schedulers work |

---

## 3. Repository layout

```text
/                                   ← public GitHub repo (one repo, pnpm workspaces)
├─ AGENTS.md · CLAUDE.md            ← agent onboarding → points to vault/
├─ README.md                        ← submission README (written in P11)
├─ package.json · pnpm-workspace.yaml · .nvmrc · .editorconfig · .gitattributes
├─ .github/workflows/ci.yml
├─ docs/                            ← PRD, TRD, DATABASE_MODELS, ARCHITECTURE (specs)
├─ vault/                           ← Obsidian "project brain" (status, tasks, bugs, decisions, sessions)
├─ shared/                          ← @fernleaf/shared (built with tsup → dist/{cjs,esm,d.ts})
│  └─ src/
│     ├─ permissions/               ← PERMISSIONS catalogue, DEFAULT_ROLES, labels/groups
│     ├─ authz/                     ← CASL Action/Subject types + buildRules(user) from permission codes
│     ├─ contracts/                 ← Zod request schemas + response types per module, error envelope, pagination
│     ├─ domain/                    ← PURE business rules (no I/O):
│     │   money.ts · time.ts · cutoff.ts · pricing.ts · combinations.ts · menu.ts
│     │   plan.ts · drops.ts · order-status.ts · billing.ts
│     ├─ errors.ts                  ← ErrorCode union + messages
│     └─ index.ts
├─ backend/                         ← @fernleaf/backend (NestJS)
│  ├─ prisma/ schema.prisma · migrations/ · seed/
│  ├─ prisma.config.ts
│  ├─ src/
│  │  ├─ main.ts · app.module.ts
│  │  ├─ config/                    ← env schema (Zod), typed ConfigService
│  │  ├─ prisma/                    ← PrismaService, tx helpers, error mapping
│  │  ├─ authz/                     ← AbilityFactory (CASL + Prisma 7 runtime wrapper), PoliciesGuard, @CheckPolicies
│  │  ├─ common/                    ← auth guard, decorators, pipes, filters, interceptors, pagination
│  │  ├─ clock/                     ← ClockService (now/today in kitchen TZ), injectable for tests
│  │  ├─ generated/prisma/          ← Prisma client output (git-ignored)
│  │  └─ modules/
│  │     auth · staff · settings · reference · catalogue · menu · pricing
│  │     companies · employees · orders · cutoff · kitchen · dispatch (+driver)
│  │     billing · dashboards · demo · jobs · health
│  └─ test/                         ← integration tests (Neon test branch)
├─ frontend/                        ← @fernleaf/frontend (Next.js)
│  ├─ next.config.ts                ← rewrites /api/* → API_ORIGIN
│  └─ src/
│     ├─ proxy.ts                   ← redirect to /login when no session cookie
│     ├─ app/(auth)/login · app/(app)/… (see §7.1)
│     ├─ components/ui (shadcn) · components/{data-table,forms,layout,status}
│     ├─ features/<area>/           ← hooks + components per domain area
│     └─ lib/                       ← api-client, query-keys, auth (MeProvider, CASL AbilityProvider/<Can>), format (money/time)
└─ scripts/                         ← perf script (400-order day), vault helpers
```

**Package boundaries.**

- `@fernleaf/shared` has **no runtime dependencies besides `zod`, `date-fns`/`@date-fns/tz` and `@casl/ability`**, and no Node-only or browser-only APIs.
- `backend/` and `frontend/` both import from `shared/`. Shared never imports from either app.
- `domain/` functions are pure and deterministic. "Now" is always passed in as a parameter, never read from the clock.

---

## 4. Configuration and environments

### 4.1 Environments

| Env | Web | API | DB (Neon branch) |
|---|---|---|---|
| Local dev | `pnpm dev` → http://localhost:3000 | http://localhost:4000 | `dev` branch |
| Test (CI/local) | — | in-process (supertest) | `test` branch (reset per run) |
| Production | Vercel (`*.vercel.app`) | Render (`*.onrender.com`, Singapore) | `main` branch |

> **As built (ADR-029):** the project was provisioned with **one** Neon branch (`br-quiet-boat-azse3ol5`, endpoint `ep-autumn-forest-…`), used by both local dev and production. There are no `dev`/`test` branches. Destructive or bulk scripts (perf, concurrency checks) run on a throwaway branch created from it.

### 4.2 Environment variables

Validated at boot with Zod. A missing or invalid value crashes startup with a clear message.

**API (`backend/.env`)**

| Var | Example | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | Render injects `PORT` |
| `DATABASE_URL` | `postgresql://…neon.tech/neondb?sslmode=require` | Runtime. On Render use the **direct** endpoint (long-running server, `pg` pool max 5). The pooled endpoint is a fallback |
| `DIRECT_DATABASE_URL` | same as above (direct) | Used by `prisma.config.ts` for migrations and seed |
| `JWT_SECRET` | 64 random bytes (base64) | Session signing |
| `SESSION_TTL_HOURS` | `12` | Cookie and JWT lifetime |
| `WEB_ORIGIN` | `https://fernleaf-kitchen.vercel.app` | Origin check on mutations; CORS stays disabled (same-origin proxy) |
| `CRON_SECRET` | random | Optional `POST /api/internal/tick` for an external scheduler |
| `TZ` | `UTC` | **Deliberately UTC in production** to prove kitchen-TZ logic doesn't depend on the server TZ |

**Web (`frontend/.env`)**

| Var | Example | Notes |
|---|---|---|
| `API_ORIGIN` | `https://fernleaf-api.onrender.com` | Used by the `rewrites()` in `next.config.ts`. **Read at build time**, so set it before deploying |
| `NEXT_PUBLIC_APP_NAME` | `Fernleaf Kitchen Ops` | Cosmetic |

`.env.example` files are committed. Real `.env*` files are git-ignored.

---

## 5. Backend design (NestJS)

### 5.1 Module map

| Module | Responsibility | Depends on |
|---|---|---|
| `health` | `/api/health` (liveness, **no DB**), `/api/health/ready` (DB ping) | — |
| `auth` | Login, logout, me; JWT cookie issue and verify | prisma, staff |
| `authz` (global) | `AuthGuard`, `AbilityFactory` (CASL), `PoliciesGuard` + `@CheckPolicies`, `@CurrentUser`, `MoneyRedactionInterceptor` | shared/permissions, shared/authz |
| `staff` | Staff users, roles (read), password reset | authz |
| `settings` | Platform settings, kitchen holidays, public domains, cut-off preview | clock |
| `reference` | Allergens, dietary tags, stations, portion sizes, packaging types | — |
| `catalogue` | Dishes, options, option groups, portions | reference |
| `pricing` | Tiers, tier prices, **price resolution** (domain/pricing) | catalogue, settings |
| `menu` | Categories, items, hiding, **employee menu resolution** (domain/menu) | catalogue, pricing, companies |
| `companies` | Companies, domains, addresses, calendar, delivery defaults, visibility, owner | settings, staff |
| `employees` | Employees, move, CSV import | companies |
| `orders` | Order context, quote, create/edit/place/cancel/reject, overrides, list/detail, timeline | menu, pricing, companies, employees, cutoff(calendar), drops |
| `cutoff` | Cut-off calculation, processing, run log, overview | orders, drops, settings, clock |
| `kitchen` | Board, unit transitions, force-complete | orders |
| `dispatch` | Drops, dispatch board, transitions, driver endpoints, photos | orders |
| `billing` | Uninvoiced, invoices, mark paid, adjustments (cancellation/shortage) | orders |
| `dashboards` | Read models for the 4 dashboards | orders, kitchen, dispatch, billing |
| `jobs` | Timers, bootstrap catch-up, request catch-up, nightly | cutoff, demo |
| `demo` | Rolling demo data, autopilot, regenerate | everything (via services) |

Dependency rule: **modules call other modules' services, never their Prisma tables directly**. Exception: read-only dashboard queries may join across tables in `dashboards` for performance, and they are documented there.

### 5.2 Layering

```text
HTTP ─▶ Controller ─▶ Service (use case, transaction) ─▶ Domain function (pure, from @fernleaf/shared)
            │                   │
   ZodValidationPipe      PrismaService (tx)
   PoliciesGuard (CASL)
```

* **Controllers** are thin: they parse params, apply guards and DTOs, call one service method, and return a DTO.
* **Services** own transactions, locking and loading, call pure domain functions to decide, then persist and append timeline events.
* **Domain functions** (`@fernleaf/shared/domain`) hold the rules: cut-off, price resolution, combination validation and pricing, menu visibility, plans and lateness, stage derivation, invoice building. **All business-rule tests target these first.**

### 5.3 Request lifecycle

1. Browser → `https://<web>/api/...` → Vercel rewrite → `https://<api>/api/...`. The cookie is first-party on the web origin.
2. `helmet`, `cookie-parser`, JSON body limit 1 MB (multipart for photos goes through Multer, ≤ 5 MB raw).
3. **Global `AuthGuard`**: verify the JWT from the `fl_session` cookie, load the user and role (active? `tokenVersion` matches?), and attach `{ id, name, roleKey, permissions:Set }`. Routes marked `@Public()` skip this.
4. **Global `PoliciesGuard`**: `AbilityFactory` builds the user's CASL ability from their role's permission codes (`buildRules` in shared). The guard then evaluates the route's `@CheckPolicies(...)` handlers, e.g. `(a) => a.can('create', 'Order')`. Any failure → 403 `FORBIDDEN`. A route **without** `@CheckPolicies` and **without** `@Public()` fails closed (a startup check enumerates routes and refuses to boot if one is undecorated).
5. **Origin check** on non-GET requests: the `Origin` header must equal `WEB_ORIGIN`, which is defence in depth against CSRF.
6. `ZodValidationPipe` validates body, query and params → 400 `VALIDATION_FAILED` with field paths.
7. Controller → service → domain → Prisma.
8. **`CatchUpInterceptor`** (authenticated requests): fire-and-forget `jobs.ensureFresh()`, throttled to once per 60 s per instance (§5.10).
9. **`MoneyRedactionInterceptor`**: if `ability.cannot('read', 'Money')` (granted by `money.read`), recursively strip keys ending in `Cents` from the response (FR-ACC-05). This works because of the naming convention: *every* money field ends in `Cents`.
10. **Global exception filter** maps DomainError, Prisma errors and Nest HttpExceptions to the error envelope (§5.6).

### 5.4 Authentication

| Aspect | Decision |
|---|---|
| Credential check | `POST /api/auth/login {email, password}` → lower-case email lookup, `isActive`, `bcrypt.compare`. On failure, return the same generic error for a wrong email and a wrong password |
| Session | JWT (HS256) `{ sub, tv: tokenVersion, iat, exp }`, TTL 12 h, in cookie `fl_session`: `HttpOnly; Secure; SameSite=Lax; Path=/`, **no `Domain`** (host-only on the web origin through the proxy) |
| Revocation | `tokenVersion` bumped on deactivate, role change and password reset. The guard compares it on every request (BR-ACC-02) |
| Logout | `POST /api/auth/logout` clears the cookie |
| Brute force | `@nestjs/throttler`: 10 login attempts/min per IP (trust proxy for `x-forwarded-for`) |
| Password storage | bcryptjs cost 10. The four test accounts are seeded with exactly `Test@1234` |
| Frontend | `proxy.ts` redirects to `/login` when the cookie is missing (cheap check). The real gate is the API: `GET /api/auth/me` returns user and permissions, and a 401 anywhere → login |

### 5.5 Authorisation (permission codes → CASL abilities)

**Permission catalogue** (`@fernleaf/shared/permissions`, the single source of truth):

| Group | Codes |
|---|---|
| Dashboards | `dashboard.admin` · `dashboard.kitchen` · `dashboard.dispatch` · `dashboard.driver` |
| Staff & roles | `staff.read` · `staff.manage` · `roles.manage` *(Could)* |
| Settings & reference | `settings.read` · `settings.manage` · `reference.read` · `reference.manage` |
| Catalogue, menu, pricing | `catalogue.read` · `catalogue.manage` · `menu.read` · `menu.manage` · `pricing.read` · `pricing.manage` |
| Customers | `companies.read` · `companies.manage` · `employees.read` · `employees.manage` |
| Orders | `orders.read` · `orders.create` · `orders.edit` · `orders.cancel` · `orders.reject` · `orders.override` |
| Money | `money.read` (see prices, totals and invoices in any payload) |
| Cut-off | `cutoff.read` · `cutoff.run` |
| Kitchen | `kitchen.read` · `kitchen.work` · `kitchen.forceComplete` |
| Dispatch & delivery | `dispatch.read` · `dispatch.manage` · `delivery.perform` (= can be assigned drops and act on own drops) |
| Billing | `billing.read` · `billing.manage` |
| Demo | `demo.manage` |

**Default roles (seed data, not code paths):**

| Role | Permissions |
|---|---|
| `admin` | every code **except** `delivery.perform` and `dashboard.driver` (admins aren't drivers: they act on drops through `dispatch.manage`, and a personal "my deliveries" view would always be empty) |
| `kitchen` | `dashboard.kitchen`, `kitchen.read`, `kitchen.work`, `catalogue.read`, `reference.read`, `orders.read` |
| `dispatch` | `dashboard.dispatch`, `dispatch.read`, `dispatch.manage`, `kitchen.read`, `orders.read`, `companies.read`, `reference.read` |
| `driver` | `dashboard.driver`, `delivery.perform` |

**From codes to abilities (CASL, ADR-023).** Roles store permission *codes* (data). One file, `shared/src/authz/rules.ts`, turns codes into CASL rules. It's the only place codes are interpreted, and it **never looks at role names**:

```ts
export type Action = 'manage' | 'read' | 'create' | 'update' | 'cancel' | 'reject' | 'override'
  | 'run' | 'work' | 'forceComplete' | 'assignDriver' | 'markReady' | 'sendOut' | 'deliver';
export type SubjectName = 'Order' | 'PrepUnit' | 'Drop' | 'Invoice' | 'Catalogue' | 'Menu' | 'Pricing'
  | 'Company' | 'Employee' | 'Staff' | 'Role' | 'Settings' | 'ReferenceData' | 'Cutoff' | 'Money'
  | 'KitchenBoard' | 'DispatchBoard' | 'DemoData' | 'AdminDashboard' | 'KitchenDashboard' | 'DispatchDashboard'
  | 'DriverDashboard' | 'all';
// Subjects with conditions declare their fields, so conditions are type-checked:
export type DropSubject = ForcedSubject<'Drop'> & { driverId: string | null };

// The real file maps every code through an exhaustive Record<PermissionCode, Grant>, so a new
// code without a grant fails to compile. Shown here as straight-line code for readability:
export function buildRules(user: { id: string; permissions: readonly PermissionCode[] }) {
  const { can, rules } = new AbilityBuilder<MongoAbility<[Action, Subject]>>(createMongoAbility);
  const has = (p: PermissionCode) => user.permissions.includes(p);
  if (has('orders.read'))      can('read', 'Order');
  if (has('orders.create'))    can('create', 'Order');
  if (has('money.read'))       can('read', 'Money');
  if (has('kitchen.work'))     can('work', 'PrepUnit');
  if (has('dispatch.manage'))  can(['assignDriver', 'markReady', 'sendOut', 'deliver'], 'Drop');
  if (has('delivery.perform')) can(['read', 'deliver'], 'Drop', { driverId: user.id }); // row rule
  // … one line per permission code (the full mapping lives in this one file)
  return rules;
}
```

| Where | How it's enforced |
|---|---|
| Route access | Global `PoliciesGuard` + `@CheckPolicies((a) => a.can('create', 'Order'))` on every controller method. Fail-closed boot check |
| Row access (lists) | `where: { AND: [accessibleBy(ability, 'read').Drop, { deliveryDate: today }] }`. A driver's query can't return other drivers' drops |
| Row access (one record) | Load through `accessibleBy`. Not found → **404**, so the API doesn't reveal that the record exists |
| Field access (money) | `MoneyRedactionInterceptor` strips `*Cents` when `ability.cannot('read', 'Money')` |
| Frontend | `/api/auth/me` returns the permission codes → the same `buildRules()` → `createMongoAbility` → `@casl/react` `<Can I="create" a="Order">` for nav, routes and buttons. This is cosmetic; the API is the gate |
| Assignable drivers | Active users whose role has `delivery.perform` (a code check in the query, never a role name) |

**Backend wiring:**

- `@casl/prisma`'s default entry reads model types from `@prisma/client`. Prisma 7 generates the client into `backend/src/generated/prisma`, so `backend/src/authz/casl-prisma.ts` wraps `@casl/prisma/runtime` with the generated types. The CASL README section "Custom PrismaClient output path" covers this.
- `AbilityFactory.createForUser(user)` = `createPrismaAbility(buildRules(user))`.
- Rule conditions stay simple equalities (`{ driverId }`), so the same rules work in the Prisma ability (backend) and the Mongo ability (frontend).

**Business rules stay out of abilities.** Abilities answer "may this user attempt this?". State rules ("only Confirmed orders can be cooked", "locked after cut-off") stay in the domain functions and services, where they are tested by BR ID.

**Adding a role** = insert a `Role` row with codes (seed, or a future roles UI). Nav, routes, dashboard sections and API access all adapt with no code change. **Adding a capability** = a new code in the catalogue + one line in `buildRules`. *Guard-rail:* an ESLint `no-restricted-syntax` rule flags the string literals `'admin' | 'kitchen' | 'dispatch' | 'driver'` outside seed files.

### 5.6 Validation and the error model

**Envelope** (every non-2xx response):

```json
{
  "error": {
    "code": "COMBINATION_INVALID",
    "message": "Choose a protein for combination 2 of Paneer Rice Bowl.",
    "status": 422,
    "fieldErrors": { "lines.0.combinations.1.choices": ["Choose a protein"] },
    "details": { "dishId": "…" }
  }
}
```

| HTTP | When | Example codes |
|---|---|---|
| 400 | Schema validation (shape, types, ranges) | `VALIDATION_FAILED` |
| 401 | No/invalid/expired session | `UNAUTHENTICATED` |
| 403 | Missing permission or out-of-scope resource | `FORBIDDEN` |
| 404 | Unknown id (or not visible to the caller) | `NOT_FOUND` |
| 409 | State conflicts and races | `ORDER_VERSION_CONFLICT`, `INVALID_TRANSITION`, `UNIT_ALREADY_STARTED`, `UNIT_ALREADY_DONE`, `ALREADY_INVOICED`, `DROP_ALREADY_DISPATCHED`, `UNIQUE_VIOLATION` |
| 422 | Business-rule violations | `ORDER_LOCKED`, `DATE_NOT_DELIVERABLE`, `DISH_NOT_AVAILABLE`, `COMBINATION_INVALID`, `QUANTITY_MISMATCH`, `MIN_QTY_NOT_MET`, `FLAG_NOT_ALLOWED`, `CUTOFF_NOT_REACHED`, `PUBLIC_EMAIL_DOMAIN`, `DOMAIN_TAKEN`, `EMAIL_DOMAIN_MISMATCH`, `OWNER_CANNOT_MOVE`, `DRIVER_REQUIRED`, `DROP_NOT_READY`, `PORTION_SIZE_UNSUPPORTED`, `TIER_CYCLE`, `ALLERGEN_ACK_REQUIRED` |

* **Domain errors** are thrown as `DomainError(code, message, { fieldErrors?, details? })`, and the filter maps each code to its status through a table in shared.
* **Prisma errors**: P2002 (unique) → 409 `UNIQUE_VIOLATION`, or a specific code when the constraint is known (e.g. `InvoiceLine_orderId_key` → `ALREADY_INVOICED`). P2025 → 404. CHECK violations (23514) → 422 `INVARIANT_VIOLATION` and logged as a bug signal.
* **The frontend** maps `fieldErrors` into React Hook Form `setError`, shows `message` in a toast or banner, and switches on `code` where special UX is needed (e.g. a 409 version conflict → "Reload" dialog).
* **Messages are written for the user**: they say what is wrong and how to fix it.

### 5.7 Transactions and concurrency

| Situation | Technique | Error when losing a race |
|---|---|---|
| Edit order (lines/delivery) | Optimistic: client sends `version`; `updateMany({ where: { id, version } , data: { …, version: { increment: 1 } } })`. Lines are replaced inside the same TX | 409 `ORDER_VERSION_CONFLICT` |
| Status transitions | `updateMany({ where: { id, status: { in: allowedFrom } } })`, check `count` | 409 `INVALID_TRANSITION` |
| Kitchen unit start/done | Interactive TX: `SELECT … FROM "Order" WHERE id = $1 FOR UPDATE` → read unit → conditional update → recompute order kitchen times | 409 `UNIT_ALREADY_*` |
| Cut-off for date D | TX + `pg_advisory_xact_lock(hashtext('cutoff:'+D))` + status-conditional `updateManyAndReturn` + drop upsert on unique key | Serialised; a second run reports 0 changes |
| Drop transitions | TX + `SELECT … FROM "Drop" WHERE id FOR UPDATE` + readiness check + conditional update | 409 `INVALID_TRANSITION` / 422 `DROP_NOT_READY` |
| Invoice creation | TX + unique `InvoiceLine.orderId/adjustmentId` | 409 `ALREADY_INVOICED` |
| Default tier switch | Single-row update on settings | — |
| Demo window generation | TX-scoped advisory lock `demo-window` | Second caller skips |

Interactive transactions use `prisma.$transaction(async (tx) => …, { timeout: 15_000 })`. Locks are **transaction-scoped** only, which keeps them compatible with PgBouncer transaction pooling if we ever switch to Neon's pooled endpoint.

### 5.8 Time handling

* **One source of time:** `ClockService.now()` returns a `Date` (instant). `ClockService.today()` returns the kitchen-local `CalendarDate` (`'YYYY-MM-DD'`) computed with the settings' time zone. Tests inject a fixed clock.
* **Types:** `CalendarDate` is a branded `'YYYY-MM-DD'` string; `MinutesOfDay` is an int from 0 to 1439; instants are `Date` or ISO strings over the wire.
* **Conversions** (in `shared/domain/time.ts`, built on `@date-fns/tz`):
  - `toInstant(date: CalendarDate, minutes: MinutesOfDay, tz): Date`
  - `toKitchenDate(instant: Date, tz): CalendarDate`
  - `addDays(date, n)`, computed in pure calendar arithmetic via `Date.UTC`
  - `isoWeekday(date)`, where 1 = Monday and 7 = Sunday
* **Prisma `@db.Date`** columns: write with `toDbDate('2026-10-05')`, which gives `new Date(Date.UTC(2026, 9, 5))`. Read with `fromDbDate(d)`, which gives `d.toISOString().slice(0, 10)`. Never use local-time getters on these values.
* **Wire format:** dates as `'YYYY-MM-DD'`, times of day as `'HH:mm'` or minutes, instants as ISO-8601 UTC. The web app formats instants with `Intl.DateTimeFormat(…, { timeZone: kitchenTz })` and labels them "IST".
* **Proof:** domain tests run in CI under `TZ=UTC`, `TZ=America/Los_Angeles` and `TZ=Asia/Kolkata`. Production runs with `TZ=UTC`.

### 5.9 Money handling

* `shared/domain/money.ts`:
  - `type Cents = number` (integer, asserted with `Number.isSafeInteger`);
  - `sum(…)`, `mul(cents, qty)`;
  - `divCeil(a, b)` (exact integer ceiling division);
  - `deriveCents(base, factorBps) = divCeil(base × factorBps, 50_000) × 5`, the 5-cent ceiling (BR-PRC-03);
  - `formatUsd(cents)` (display only, `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`).
* **No floats in money paths.** Multipliers and percentages are basis points. The UI converts "2.4×" and "+15 %" to bps once, at input.
* Totals are computed **only** in `shared/domain/combinations.ts` → `priceLine()` / `priceOrder()`. Services persist exactly what those return, and reconciliation tests assert order = Σ lines and invoice = Σ lines.

### 5.10 Jobs and scheduling (DB-frugal by design)

**Constraint:** Neon free = 100 CU-hours per month at 0.25 CU, so the DB can be awake about 400 h/month (~55 % of the time). Anything that queries the DB every minute would exhaust that. Render free sleeps after 15 min without traffic, which a keep-alive ping to `/api/health` (**no DB**) prevents.

| Job | Trigger(s) | DB use |
|---|---|---|
| **Cut-off processing** (BR-CUT-04/05) | (1) **Precise timer** armed for the next cut-off instant (computed in memory from cached settings; re-armed after each run and on settings change). (2) **Bootstrap catch-up** on startup. (3) **Request catch-up**: throttled ≤ 1/min, only while humans use the app. (4) **Manual** `POST /api/cutoff/run`. All are no-ops when `autoCutoffEnabled = false` except manual | Only around cut-off instants and during active use |
| **Demo window top-up** (FR-DAT-02) | Bootstrap + timer at 00:05 kitchen time + request catch-up (once per kitchen day) | A few seconds per day |
| **Demo autopilot** (FR-DAT-03) | **Request catch-up only** (≤ 1/min while someone is using the app) + bootstrap | Zero when nobody is looking |
| External cron (optional) | `POST /api/internal/tick` with `X-Cron-Secret` runs the same `ensureFresh()` | — |

`JobsService.ensureFresh(now)` is idempotent and guarded by an in-flight promise, so concurrent callers share one run. It (a) processes any passed-but-unprocessed cut-offs, (b) ensures the demo window, and (c) advances the autopilot.

### 5.11 File uploads (delivery photo)

* The client compresses to JPEG/WebP ≤ 1600 px on the long edge at quality 0.8, typically 150–400 KB, then sends `multipart/form-data` (field `photo`) with `note`.
* The API uses Multer memory storage, `limits.fileSize = 5 MB`, and MIME whitelist `image/jpeg|png|webp`. It stores the result in `DeliveryPhoto.data` (bytea), 1:1 with the drop.
* Served through `GET /api/drops/:id/photo` with auth and scope checks, and `Cache-Control: private, max-age=3600`.

### 5.12 Lists: pagination, sorting, filtering

* Query: `?page=1&pageSize=25&sort=deliveryAt:desc&…filters`. `pageSize` max 100.
* Response: `{ items, page, pageSize, total, totalPages }`.
* Sort fields are whitelisted per endpoint. Filters are validated by a Zod schema shared with the web app, and the web app mirrors them in the URL.

### 5.13 Logging and "emails"

* Nest `Logger` with a request id. Domain events of interest (cut-off runs, invoice issued, autopilot runs) are logged at `info`.
* Wherever an email would be sent (invoice issued to the billing contact, cancelled order), we write `logger.log('[email-simulated] …')` (A-35).

---

## 6. API specification

Base path `/api`. JSON unless noted. `🔓` = public. Money fields (`*Cents`) are stripped for callers without `money.read`. The **Permission** column names the code that grants the CASL ability the route checks (e.g. `orders.create` → `can('create', 'Order')`).

### 6.1 Health, meta, auth

| Method & path | Permission | Notes |
|---|---|---|
| `GET /health` | 🔓 | Liveness: `{ ok, version, uptimeS }`. **Never touches the DB** (keep-alive target) |
| `GET /health/ready` | 🔓 | DB ping (not used by the keep-alive) |
| `GET /meta/clock` | any signed-in | `{ now, today, timezone: "Asia/Kolkata", currency: "USD" }` |
| `POST /auth/login` | 🔓 (throttled) | Sets `fl_session`; returns `me` |
| `POST /auth/logout` | any signed-in | Clears the cookie |
| `GET /auth/me` | any signed-in | `{ user, role: {key,name}, permissions: string[] }` |

### 6.2 Staff, settings, reference

| Method & path | Permission |
|---|---|
| `GET /staff` · `GET /roles` | `staff.read` |
| `POST /staff` · `PATCH /staff/:id` · `POST /staff/:id/reset-password` | `staff.manage` |
| `GET /settings` · `GET /settings/kitchen-holidays` · `GET /settings/public-domains` · `GET /settings/cutoff-preview?date=` | `settings.read` |
| `PATCH /settings` · `POST|DELETE /settings/kitchen-holidays[/:id]` · `POST|DELETE /settings/public-domains[/:domain]` | `settings.manage` |
| `GET /reference/:type` (`allergens`, `dietary-tags`, `kitchen-stations`, `portion-sizes`, `packaging-types`) | `reference.read` |
| `POST /reference/:type` · `PATCH /reference/:type/:id` | `reference.manage` |

### 6.3 Catalogue, pricing, menu

| Method & path | Permission | Notes |
|---|---|---|
| `GET /dishes?q&active&stationId&page` · `GET /dishes/:id` | `catalogue.read` | Detail includes groups, options, menu placements, tiers missing a price |
| `POST /dishes` · `PATCH /dishes/:id` · `POST /dishes/:id/activate` · `POST /dishes/:id/deactivate` | `catalogue.manage` | No DELETE route exists |
| `POST /dishes/:id/option-groups` · `PATCH /option-groups/:id` · `DELETE /option-groups/:id` · `PUT /dishes/:id/option-groups/order` | `catalogue.manage` | |
| `PUT /option-groups/:id/options` (ordered ids) · `PUT /option-groups/:id/portion-sizes` | `catalogue.manage` | Portion invariant checked (FR-CAT-05) |
| `GET /options` · `POST /options` · `PATCH /options/:id` · `PUT /options/:id/portion-prices` | `catalogue.read` / `.manage` | |
| `GET /price-tiers` · `GET /price-tiers/:id/grid?kind=dish|option&missingOnly&q` | `pricing.read` | Grid rows: explicit, derived, effective, source |
| `POST /price-tiers` · `PATCH /price-tiers/:id` · `DELETE /price-tiers/:id` · `POST /price-tiers/:id/make-default` | `pricing.manage` | DELETE only if unreferenced; derivation validated (shape, acyclic) |
| `PUT /price-tiers/:id/prices` | `pricing.manage` | Bulk: `[{ itemType, itemId, action: "set"|"exclude"|"clear", priceCents? }]` |
| `GET /menu/categories` | `menu.read` | Includes items |
| `POST|PATCH|DELETE /menu/categories[/:id]` · `PUT /menu/categories/order` · `POST /menu/categories/:id/items` · `PATCH|DELETE /menu/items/:id` · `PUT /menu/categories/:id/items/order` | `menu.manage` | |
| `GET /menu/for-employee/:employeeId` · `GET /menu/for-employee/:employeeId/secret/:slug` | `menu.read` **or** `orders.create` | The single employee-menu function (BR-MEN-04) |

### 6.4 Companies and employees

| Method & path | Permission | Notes |
|---|---|---|
| `GET /companies?q&active&page` · `GET /companies/:id` | `companies.read` | |
| `POST /companies` | `companies.manage` | Creates company + owner employee + first domain + first address in one TX |
| `PATCH /companies/:id` · `PUT /companies/:id/owner` · `PUT /companies/:id/menu-visibility` | `companies.manage` | |
| `POST|DELETE /companies/:id/domains[/:domainId]` · `POST|PATCH /companies/:id/addresses[/:addressId]` · `POST /companies/:id/addresses/:addressId/make-default|archive` · `POST|DELETE /companies/:id/holidays[/:id]` | `companies.manage` | A holiday with open orders returns warnings (FR-CMP-05) |
| `GET /employees?companyId&q&page` · `GET /employees/:id` | `employees.read` | |
| `POST /employees` · `PATCH /employees/:id` · `POST /employees/:id/move` | `employees.manage` | |
| `POST /companies/:id/employees/import` (multipart CSV) · `GET /employees/import-template.csv` | `employees.manage` | Report: `{ created, failed: [{ row, column, message }] }` |

### 6.5 Orders and cut-off

| Method & path | Permission | Notes |
|---|---|---|
| `GET /orders?q&dateFrom&dateTo&status&companyId&invoiced&page&sort` | `orders.read` | Server pagination |
| `GET /orders/open-on?date&companyId` | `orders.read` | FR-CMP-05 holiday warning: open (Draft/Placed/Confirmed) orders on a date, one company or all; first 50 + total. Read-only |
| `GET /orders/:id` | `orders.read` | Lines, choices, money, delivery, plans/actuals, drop, invoice, adjustments, timeline |
| `GET /orders/context?employeeId&date` | `orders.create` | Deliverable dates (next 21 days) with cut-off instants, allowed addresses/times/packaging per flags, defaults |
| `POST /orders/quote` | `orders.create` / `orders.edit` | Validates and prices without persisting: normalised lines, `fieldErrors`, warnings (allergens, min qty) |
| `POST /orders` | `orders.create` | `intent: "DRAFT" | "PLACE"`. After cut-off, `orders.override` ⇒ late order created Confirmed |
| `PUT /orders/:id` | `orders.edit` | Full replace of lines and delivery choices, with `version` |
| `POST /orders/:id/place` | `orders.edit` | Draft → Placed |
| `POST /orders/:id/cancel` | `orders.cancel` (+ `orders.override` when locked) | `{ reason }`. Billing effect per BR-BIL-06 |
| `POST /orders/:id/reject` | `orders.reject` | `{ reason }` |
| `PATCH /orders/:id/delivery` | `orders.override` | `{ deliveryTime?, addressId?, packagingTypeId? }`. Re-plans and re-drops |
| `POST /orders/:id/shortage` | `billing.manage` | `{ items: [{ combinationId, shortQty }], note }` → credit adjustment |
| `GET /cutoff/overview?from&to` | `cutoff.read` | Per date: `cutoffAt`, locked?, counts by status, last runs |
| `POST /cutoff/run` | `cutoff.run` | `{ deliveryDate }`. 422 `CUTOFF_NOT_REACHED` if the cut-off is in the future |

### 6.6 Kitchen, dispatch, driver

| Method & path | Permission | Notes |
|---|---|---|
| `GET /kitchen/board?date&stationId` | `kitchen.read` | Units, plan, lateness, summary (one round trip) |
| `POST /kitchen/units/:id/start` · `POST /kitchen/units/:id/done` | `kitchen.work` | |
| `POST /kitchen/orders/:id/force-complete` | `kitchen.forceComplete` | |
| `GET /dispatch/board?date` · `GET /dispatch/drivers` | `dispatch.read` | Drivers = active users with `delivery.perform` |
| `PATCH /dispatch/drops/:id/driver` · `POST /dispatch/drops/:id/dispatch-ready` · `POST /dispatch/drops/:id/out-for-delivery` · `POST /dispatch/drops/:id/delivered` | `dispatch.manage` | `delivered` is multipart (note, photo) |
| `GET /driver/drops` | `delivery.perform` | **Own drops, today only** |
| `POST /driver/drops/:id/delivered` | `delivery.perform` | Own drop, must be out for delivery. Multipart |
| `GET /drops/:id/photo` | `dispatch.read`, or `delivery.perform` on own drop | |

### 6.7 Billing, dashboards, demo

| Method & path | Permission | Notes |
|---|---|---|
| `GET /billing/summary` | `billing.read` | Per company: uninvoiced amount and count, open invoices |
| `GET /billing/companies/:id/uninvoiced?upTo` | `billing.read` | Orders + adjustments |
| `POST /billing/invoices` | `billing.manage` | `{ companyId, orderIds[], adjustmentIds[] }` |
| `GET /billing/invoices?companyId&status&page` · `GET /billing/invoices/:id` | `billing.read` | |
| `POST /billing/invoices/:id/mark-paid` | `billing.manage` | Issued → Paid only |
| `GET /dashboards/admin` · `/kitchen?date` · `/dispatch?date` · `/driver` | `dashboard.<role>` | Figures exactly as in PRD §8 |
| `GET /demo/status` · `POST /demo/regenerate` | `demo.manage` | |
| `POST /internal/tick` | `X-Cron-Secret` header | Optional external scheduler |

---

## 7. Frontend design (Next.js)

### 7.1 Routes

| Route | Requires | Screen |
|---|---|---|
| `/login` | — | Email/password, demo-account hints |
| `/dashboard` | any `dashboard.*` | Sections composed by permission (PRD §8) |
| `/orders` · `/orders/[id]` | `orders.read` | List with URL filters · detail + timeline |
| `/orders/new` · `/orders/[id]/edit` | `orders.create` · `orders.edit` | Order builder |
| `/cutoff` | `cutoff.read` | Lock times, pending dates, run history, "Run now" |
| `/kitchen` | `kitchen.read` | Kitchen board |
| `/dispatch` | `dispatch.read` | Dispatch board |
| `/driver` | `delivery.perform` | Mobile driver view |
| `/billing` · `/billing/companies/[id]` · `/billing/invoices/[id]` | `billing.read` | Summary · uninvoiced + create · invoice |
| `/catalogue/dishes[/id]` · `/catalogue/options` | `catalogue.read` | |
| `/menu` · `/menu/preview` | `menu.read` | Categories/items · preview as employee |
| `/pricing` · `/pricing/[tierId]` | `pricing.read` | Tiers · tier grid |
| `/companies[/id]` · `/employees` | `companies.read` · `employees.read` | Tabs: details, domains, addresses, calendar, delivery, menu & price, employees |
| `/settings` (platform, kitchen calendar), `/settings/reference`, `/settings/staff`, `/settings/demo` | `settings.read` / `reference.read` / `staff.read` / `demo.manage` | |

* **Navigation config** is one array of `{ href, label, icon, action, subject }`, filtered with the CASL ability (`useAbility` from `@casl/react`).
* Page-level `<RequireAbility action subject>` renders a 403 page instead of content. The data APIs enforce access anyway.

### 7.2 Data layer

* `lib/api-client.ts`: `fetch('/api' + path, { credentials: 'same-origin' })`. It parses the error envelope into `ApiError { code, status, message, fieldErrors }`, and a 401 → `router.replace('/login')`.
* **Query keys** live in a central factory (`qk.orders.list(filters)`, `qk.kitchen.board(date, station)`). Mutations invalidate exact keys.
* **Polling**: kitchen and dispatch boards every 15 s, driver every 30 s, dashboards every 60 s. Polling stops in hidden tabs (TanStack default), which saves Neon compute.
* **Optimistic updates** for unit start/done and drop actions, rolled back on 409 with a toast that names the winner ("Already done by Vikram at 10:42").
* **The browser never decides prices or locks.** The order builder calls `POST /orders/quote` (debounced 300 ms) and renders the server's breakdown and errors.

### 7.3 Key screens (UX notes)

| Screen | Notes |
|---|---|
| **Order builder** | Steps: employee → date (calendar disables non-deliverable or locked days and shows "locks Mon 16:00 IST") → menu (categories, search, allergen and diet badges, secret-slug box) → cart: each line has combination rows (one select per group, size chips if portioned, qty stepper, "+ Add combination"), live "6 + 4 = 10" counter, inline server errors → delivery panel (fields disabled with a tooltip when a flag disallows) → sticky footer: total, **Save draft**, **Place order** |
| **Kitchen board** | Date and station chips with counts; summary strip (late / at risk / in progress / done); grouped by planned kitchen-ready slot; unit card = dish, combination text, qty, order #, employee, allergen flags; big **Start** / **Done** buttons; LATE in red, AT RISK in amber. 1,000 cards: memoised cards, collapsible groups, `content-visibility: auto`, plus virtualization if measurement demands it |
| **Dispatch board** | Drops grouped by delivery time: company, address label, boxes, readiness bar (x/y kitchen-ready), driver select (default pre-filled), next-step button, lateness badges, filters by stage and driver |
| **Driver view** | Phone-first: large cards in time order, a "Next stop" hero, tap-to-call and maps link, **Mark delivered** sheet with note and camera input (`accept="image/*" capture="environment"`), client-side compression, works one-handed |
| **Tier grid** | Plain table (ADR-026): SKU, dish, cost, base price (if derived), derived, override input, effective, source badge; "Missing only" toggle; dirty-cell tracking → bulk save |
| **Menu preview** | Pick company → employee; renders exactly the employee menu payload; "Open secret category" slug input |
| **Order detail** | Header with status and stage chips, lock countdown, actions allowed for this user; tabs: Lines & money · Delivery · Timeline |

### 7.4 Formatting

* Money: `formatUsd(cents)` from shared.
* Times: `formatKitchenTime(iso)`, which uses `Intl` with `timeZone` from `/meta/clock`.
* Dates: `formatKitchenDate('2026-10-05')` → "Mon 5 Oct". Status and stage chips use colour **and** text (accessibility).

---

## 8. Domain algorithms (reference implementations)

Every algorithm below lives in `shared/src/domain/` as pure functions and has unit tests named after its BR IDs.

### 8.1 Cut-off (BR-CUT-01..03)

```ts
type CalendarDate = string & { __brand: 'CalendarDate' }; // 'YYYY-MM-DD'
interface KitchenCalendar { workingDays: ReadonlySet<number>; holidays: ReadonlySet<CalendarDate> }

export const isKitchenWorkingDay = (d: CalendarDate, cal: KitchenCalendar) =>
  cal.workingDays.has(isoWeekday(d)) && !cal.holidays.has(d);

export function cutoffDate(delivery: CalendarDate, n: number, cal: KitchenCalendar): CalendarDate {
  let d = delivery;
  for (let counted = 0, guard = 0; counted < n; ) {
    d = addDays(d, -1);
    if (isKitchenWorkingDay(d, cal)) counted++;
    if (++guard > 366) throw new DomainError('CALENDAR_INVALID', 'No kitchen working day found within a year.');
  }
  return d; // n = 0 → delivery day itself
}

export const cutoffAt = (delivery: CalendarDate, s: CutoffSettings, cal: KitchenCalendar): Date =>
  toInstant(cutoffDate(delivery, s.cutoffWorkingDays, cal), s.cutoffTimeMinutes, s.timezone);

export const isLocked = (delivery: CalendarDate, now: Date, s: CutoffSettings, cal: KitchenCalendar) =>
  now.getTime() >= cutoffAt(delivery, s, cal).getTime();
```

Required tests (minimum):

* Wed delivery, N = 2, 16:00 → **Mon 16:00 IST** (brief example).
* Mon delivery with a Mon–Fri kitchen → Thu 16:00.
* Kitchen holiday on Tue → a Wed delivery locks Fri.
* N = 0 → same day.
* A company holiday doesn't change anything.
* Exactly at the cut-off instant counts as locked.
* One minute before is unlocked.
* The same results under `TZ=UTC`, `TZ=America/Los_Angeles` and `TZ=Asia/Kolkata`.
* A calendar with no working days throws.

### 8.2 Price resolution (BR-PRC-01..05)

```ts
export const divCeil = (a: number, b: number) => { const r = a % b; return (a - r) / b + (r > 0 ? 1 : 0); }; // a ≥ 0, b > 0
export const deriveCents = (baseCents: number, factorBps: number) => divCeil(baseCents * factorBps, 50_000) * 5; // ceil to 5¢

type Resolved = { cents: number | null; source: 'EXPLICIT' | 'DERIVED' | 'EXCLUDED' | 'MISSING'; reason?: 'NO_BASE_PRICE' | 'NOT_POSITIVE' | 'NOT_SET' };

export function resolvePrice(item: PricedItem, tierId: string, ctx: PricingContext, seen = new Set<string>()): Resolved {
  if (seen.has(tierId)) throw new DomainError('TIER_CYCLE', 'Price tiers derive from each other in a loop.');
  seen.add(tierId);
  const explicit = ctx.explicit(tierId, item);           // undefined | { cents: number | null }
  if (explicit) return explicit.cents === null ? { cents: null, source: 'EXCLUDED' } : { cents: explicit.cents, source: 'EXPLICIT' };
  const tier = ctx.tier(tierId);
  if (tier.derivation === 'MANUAL') return { cents: null, source: 'MISSING', reason: 'NOT_SET' };
  const base = tier.derivation === 'FROM_COST'
    ? item.costCents
    : resolvePrice(item, tier.baseTierId!, ctx, seen).cents;
  if (base === null) return { cents: null, source: 'MISSING', reason: 'NO_BASE_PRICE' };
  const cents = deriveCents(base, tier.factorBps!);
  const ok = item.kind === 'DISH' ? cents > 0 : cents >= 0;          // BR-PRC-04
  return ok ? { cents, source: 'DERIVED' } : { cents: null, source: 'MISSING', reason: 'NOT_POSITIVE' };
}
export const employeeTierId = (company: { priceTierId: string | null }, defaultTierId: string) => company.priceTierId ?? defaultTierId; // BR-PRC-01
```

Integer safety: `baseCents ≤ 10^7` ($100k) × `factorBps ≤ 10^6` gives ≤ 10^13, well below 2^53.

Tests:

* `88¢ × 2.4 = 211.2¢ → 215¢`.
* An exact multiple stays the same.
* `295.2¢ → 300¢`.
* "+15 %" of 1999 → `divCeil(1999×11500, 50000)×5 = 2300`.
* Override wins over derivation.
* Exclusion → EXCLUDED.
* Missing base → MISSING.
* A dish deriving to 0 → MISSING, while an option deriving to 0 → 0 is allowed.
* A chain of 3 tiers resolves.
* A cycle throws.
* There is no fallback to the default tier when the company tier lacks a price.

### 8.3 Combinations: validate, canonicalise, merge, price (BR-CMB-*, BR-MNY-02)

```ts
interface ChoiceIn { groupId: string; optionId: string; portionSizeId?: string | null }
interface CombinationIn { quantity: number; choices: ChoiceIn[] }
interface LineIn { dishId: string; quantity: number; combinations: CombinationIn[] }

export function normaliseLine(line: LineIn, dish: MenuDish /* groups + offered options with prices */): Result<NormalisedLine> {
  // 1. dish must be orderable for this employee (menu function) → DISH_NOT_AVAILABLE
  // 2. every combination quantity is an int ≥ 1; Σ quantities === line.quantity → QUANTITY_MISMATCH
  // 3. per combination: each choice's group ∈ dish.groups; option offered in that group (active + priced) → COMBINATION_INVALID
  //    required groups have ≥1 choice; count ≤ maxSelections; no duplicate option within a group
  //    portioned group ⇒ portionSizeId ∈ group sizes and option supports it; non-portioned ⇒ no size → PORTION_SIZE_UNSUPPORTED
  // 4. signature = `${g}:${o}${p ? '@' + p : ''}` tokens sorted by id, joined by '|' (ADR-027: stable across reorders)
  // 5. merge combinations with equal signature (sum quantities)  → each remaining one = one prep unit
  // 6. line.quantity ≥ dish.minOrderQty → MIN_QTY_NOT_MET
  // errors carry paths: lines.{i}.combinations.{j}.choices / .quantity
}

export function priceCombination(dishCents: number, choices: PricedChoice[], qty: number) {
  const unit = dishCents + choices.reduce((s, c) => s + c.optionCents + (c.portionExtraCents ?? 0), 0);
  return { unitPriceCents: unit, totalCents: unit * qty };
}
export const priceLine  = (combos: { totalCents: number }[]) => combos.reduce((s, c) => s + c.totalCents, 0);
export const priceOrder = (lines: { totalCents: number }[]) => lines.reduce((s, l) => s + l.totalCents, 0);
```

**Price capture on edit (BR-PRC-07):** when an existing order is re-saved, build a map `(dishId, signature) → captured {unitPriceCents, choicePrices, dishPriceCents}` from the stored combinations. Every normalised combination whose key exists reuses the captured prices; new keys are priced at the current tier. A retained combination whose dish or option has since become unavailable is still accepted (grandfathered), and only **new** combinations must pass the visibility checks.

Tests:

* The brief's example: 10 bowls = 6 brown rice + 4 jeera rice → OK, 2 units.
* 6 + 3 ≠ 10 → `QUANTITY_MISMATCH`.
* A missing required group.
* `maxSelections` exceeded.
* An option from another group.
* A duplicate option.
* A size on a non-portioned group and a missing size on a portioned one.
* Duplicates merged (3 + 3 identical → one unit of 6).
* The signature is independent of input order.
* Price = (dish + options) × qty.
* Order total = Σ lines.
* Min qty.
* Captured prices are kept on edit.

### 8.4 Employee menu (BR-MEN-01..04)

`resolveEmployeeMenu({ categories, items, dishes, hidden, tierId, pricing, employeeAllergies, employeePrefs, includeSecretSlug? })` returns the categories visible and listed (and the secret one if a slug is given), each with items `{ dish, priceCents, groups: [{ …, options: [{ option, priceCents, sizes? }] }], allergenConflicts[], dietMatches[] }`.

A dish is dropped when it fails any condition of BR-MEN-01, including the "a required group has no offered option" rule (A-12). Used by the menu preview, `/orders/context`, the quote, and create/edit validation (BR-MEN-04).

### 8.5 Plans and lateness (BR-PLN-*)

```ts
export const plan = (deliveryAt: Date, leadMin: number, bufferMin: number) => {
  const dispatchReadyAt = new Date(deliveryAt.getTime() - leadMin * 60_000);
  return { plannedDispatchReadyAt: dispatchReadyAt, plannedKitchenReadyAt: new Date(dispatchReadyAt.getTime() - bufferMin * 60_000) };
};
export type Timeliness = 'DONE' | 'LATE' | 'AT_RISK' | 'ON_TRACK';
export const timeliness = (planned: Date, doneAt: Date | null, now: Date, windowMin: number): Timeliness =>
  doneAt ? 'DONE' : now > planned ? 'LATE' : now.getTime() >= planned.getTime() - windowMin * 60_000 ? 'AT_RISK' : 'ON_TRACK';
```

### 8.6 Drops and stages (BR-DSP-*)

* `dropKey = companyId | addressId | deliveryAt.toISOString()`. Drops are upserted on `@@unique([companyId, addressId, deliveryAt])` with `driverId = company.defaultDriverId` on create.
* **Order stage** (derived): `DELIVERED` if `status = DELIVERED`; else `OUT_FOR_DELIVERY` if `drop.outForDeliveryAt`; else `DISPATCH_READY` if `drop.dispatchReadyAt`; else `KITCHEN_READY` if `kitchenReadyAt`; else `IN_PREP` if `kitchenStartedAt`; else `QUEUED`.
* **Drop readiness** = (# active orders with `kitchenReadyAt`) / (# active orders).
* **Transitions:**
  - *dispatch-ready* requires readiness = 1 and `dispatchReadyAt IS NULL`;
  - *out* requires `dispatchReadyAt` set, a driver, and `outForDeliveryAt IS NULL`;
  - *delivered* requires `outForDeliveryAt` set and `deliveredAt IS NULL`, then sets `deliveredOnTime = deliveredAt ≤ deliveryAt + grace`, and sets the active orders to `DELIVERED` and `deliveredAt`.
* **Override move** (BR-DSP-06): compute the new key. If the target drop is out or delivered → 422. If the target is dispatch-ready and the order isn't kitchen-ready → 422. Otherwise move the order, and delete the old drop if it's now empty and not dispatched.

### 8.7 Cut-off processing (BR-CUT-04)

```ts
async process(date: CalendarDate, trigger: CutoffTrigger, actor?: Actor) {
  const now = clock.now(); const at = cutoffAt(date, settings, calendar);
  if (now < at) throw new DomainError('CUTOFF_NOT_REACHED', `Ordering for ${fmt(date)} closes at ${fmt(at)}.`);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'cutoff:' + date}))`;
    const cancelled = await tx.order.updateManyAndReturn({ where: { deliveryDate: toDbDate(date), status: 'DRAFT' },
      data: { status: 'CANCELLED', cancelledAt: now, statusReason: 'Draft not placed before cut-off' }, select: { id: true } });
    const confirmed = await tx.order.updateManyAndReturn({ where: { deliveryDate: toDbDate(date), status: 'PLACED' },
      data: { status: 'CONFIRMED', confirmedAt: now }, select: { id: true, companyId: true, addressId: true, deliveryAt: true } });
    await replanByCompany(tx, confirmed);       // BR-PLN-03 (company lead may have changed)
    await assignDrops(tx, confirmed);           // upsert drops on unique key, set dropId, default driver
    await appendEvents(tx, cancelled, 'CANCELLED', confirmed, 'CONFIRMED');
    return tx.cutoffRun.create({ data: { deliveryDate: toDbDate(date), cutoffAt: at, trigger, triggeredById: actor?.id,
      startedAt: now, finishedAt: new Date(), draftsCancelled: cancelled.length, ordersConfirmed: confirmed.length } });
  }, { timeout: 30_000 });
}
```

**Catch-up:** `SELECT DISTINCT "deliveryDate" FROM "Order" WHERE status IN ('DRAFT','PLACED')`, then process every date whose `cutoffAt ≤ now`.

Tests (integration):

* Drafts → cancelled and placed → confirmed with drops.
* A second run reports 0 changes.
* Two concurrent runs → the total changes equal one run.
* A future cut-off → 422.
* Confirmed orders appear in the uninvoiced list.

### 8.8 Kitchen transitions (BR-KIT-*)

```text
start(unitId):  TX { lock order FOR UPDATE; order.status = CONFIRMED else 409 INVALID_TRANSITION;
                     unit.prepStartedAt IS NULL else 409 UNIT_ALREADY_STARTED; set prepStartedAt = now;
                     if order.kitchenStartedAt IS NULL → set it, event KITCHEN_STARTED }
done(unitId):   TX { lock order; status check; unit.prepDoneAt IS NULL else 409 UNIT_ALREADY_DONE;
                     set prepDoneAt = now, prepStartedAt = coalesce(prepStartedAt, now);
                     kitchenStartedAt = coalesce(kitchenStartedAt, now);
                     if no units remain undone → kitchenReadyAt = now, event KITCHEN_READY }
forceComplete(orderId): TX { lock; all undone units → done (+start); kitchenReadyAt = now; event KITCHEN_FORCE_COMPLETED }
```

### 8.9 Invoicing and adjustments (BR-BIL-*)

```text
createInvoice(companyId, orderIds, adjustmentIds):
  TX { orders = orders of companyId with status ∈ {CONFIRMED, DELIVERED} AND no invoice line, id ∈ orderIds
       adjustments = adjustments of companyId with no invoice line, id ∈ adjustmentIds
       if counts differ → 409 ALREADY_INVOICED / 422 NOT_INVOICEABLE (listing offending ids)
       if no lines → 422 EMPTY_INVOICE
       lines = orders → amount = order.totalCents ; adjustments → amount = adjustment.amountCents
       invoice = create { totalCents = Σ lines.amount, periodStart/End = min/max deliveryDate, lines }
       assert invoice.totalCents === Σ persisted lines   (BR-MNY-03)
       events INVOICED ; log "[email-simulated] invoice INV-0007 → billing@…" }
cancel/reject(order) when order has an invoice line → in the same TX create adjustment
       { kind: CANCELLATION_CREDIT, amountCents: −order.totalCents }        (BR-BIL-06)
shortage(order, items) → order.status = DELIVERED; per item 1 ≤ shortQty ≤ remaining; credit = −Σ shortQty × unitPriceCents;
       Σ credits on the order ≥ −order.totalCents                            (BR-BIL-07)
markPaid(invoice) → updateMany where status = ISSUED → PAID, paidAt = now     (BR-BIL-04)
```

Tests:

* Eligibility (statuses, not-yet-invoiced, same company).
* Total = Σ lines.
* An order can't be invoiced twice (sequential and concurrent).
* Cancelling an invoiced order → a credit equal to −total that appears in the uninvoiced list.
* Cancelling a not-invoiced order → it disappears from the uninvoiced list with no adjustment.
* Shortage credit maths and its cap.
* Mark paid only from Issued.

---

## 9. Testing strategy

| Level | What | Tooling | Where |
|---|---|---|---|
| **Unit (domain)**: highest priority | cut-off, pricing/rounding, combinations, menu visibility, plans/lateness, stage derivation, billing maths, order-status transitions | Vitest, run under 3 `TZ` values in CI | `shared/src/domain/*.test.ts` |
| **Service / integration** | Cut-off idempotency and concurrency, kitchen double-click race, invoice double-invoicing race, permission matrix (403s), driver scoping, money redaction | Vitest + supertest + Nest testing module against the Neon **test** branch (`prisma migrate reset --force` per run) | `backend/test/*.int.test.ts` |
| **Seed integrity** | Every company has owner + default address; totals reconcile on all seeded orders; driver@test.com has drops today | Vitest script | `backend/test/seed.int.test.ts` |
| **As built (ADR-029)** | Service tests boot the real Nest modules with a fake Prisma (permission matrix, auth, kitchen, dispatch, staff, companies). Races (double "done", double invoice, cut-off re-run) were verified by probes against Neon; a repeatable script for them (T-1206) runs on a throwaway Neon branch. No seed-integrity test file | Vitest + supertest | `backend/test/*.test.ts` |
| **Performance** | Generate a 400-order day; time `GET /kitchen/board` (target p95 < 800 ms on Render free) and first render (< 1.5 s) | `scripts/perf-kitchen-board.ts` | manual, results logged in the vault |
| **UI** | Not a coverage target (brief). Manual smoke checklist per release | `vault/09 Submission/Submission Checklist.md` | — |

**Conventions:** test names start with the rule ID (`BR-CUT-01 …`), and every bug fix gets a regression test whose name starts with its bug ID (`BUG-007 …`).

---

## 10. Performance plan

* **Order list:** indexed filters, `LIMIT/OFFSET` with `COUNT(*)`, a narrow `select` (no lines).
* **Kitchen board (400 orders ≈ 1,000 units):**
  - one query with explicit `select` (no `include *`), sorted in SQL by `plannedKitchenReadyAt`;
  - payload ~200–300 KB gzipped at most, built in O(n);
  - client side: memoised cards, grouped and collapsible sections, CSS `content-visibility`;
  - polling with `structuralSharing` so unchanged cards don't re-render;
  - mutations update the cache optimistically (no full refetch per click).
* **Menu resolution:** one pass over in-memory data per request; catalogue size is small (< 100 dishes).
* **Neon cold start:** the first query after idle takes ~0.5–1 s, which is acceptable. The UI shows skeletons, not spinners.

---

## 11. Security

| Concern | Control |
|---|---|
| AuthN | bcrypt hashes, generic login errors, throttled login, httpOnly + Secure + SameSite=Lax cookie, 12 h expiry, revocation via `tokenVersion` |
| AuthZ | Global CASL `PoliciesGuard` (fail-closed routes), abilities built only from permission codes, `accessibleBy` row scoping (drivers), money redaction |
| CSRF | Same-origin proxy + SameSite=Lax + JSON-only mutations + Origin check |
| Input | Zod on every input; Prisma parameterises SQL; `$queryRaw` only with tagged templates |
| Uploads | Size/MIME limits, stored in the DB, never executed, served with `Content-Type` from the whitelist and `X-Content-Type-Options: nosniff` |
| Secrets | Env vars only, `.env*` git-ignored, separate secrets per environment |
| Headers | `helmet` on the API; Next.js defaults on the web app |
| Data exposure | Kitchen, Dispatch and Driver payloads omit money; drivers see only their own drops |

---

## 12. Demo data system

| Piece | Behaviour |
|---|---|
| **Static seed** (`pnpm db:seed`, idempotent upserts by natural keys) | Roles with permissions; staff (the 4 test accounts plus 2 extra drivers, 1 extra cook); settings (kitchen **7 days**, A-02; cut-off 2 days at 16:00); reference lists; ~25 dishes across 6 stations (one dish without a station); ~25 options with groups (one portioned group); 4 tiers: **Standard** (default, cost × 2.4 with a few overrides), **Enterprise** (Standard −10 %), **Partner** (Standard +15 %), **Startup** (MANUAL, deliberately incomplete → hidden dishes); 7 categories plus a **secret** `chefs-table`; 5 companies (mixed calendars, one 7-day, one Tue–Thu; mixed tiers; hidden items; holidays); ~60 employees with allergies, preferences and flags. Full content plan: `vault/08 Knowledge/Demo Data Plan.md` |
| **Rolling window** (`DemoService.ensureWindow(now)`) | For each date in [today−14, today+7] without a `DemoDay` row, generate orders through the **same domain functions** (menu, combinations, pricing) for each company where the date is deliverable. Statuses by relative date: **past** → Delivered (~92 %), Cancelled (~5 %), Rejected (~3 %), with consistent kitchen/dispatch timestamps and on-time ≈ 85 %; **today** → Confirmed with autopilot caps; **future, cut-off passed** → Confirmed (drops assigned); **future, open** → Placed (~75 %), Draft (~20 %), Cancelled (~5 %). Invoices: weekly per company for delivered orders older than 7 days (older ones Paid, the latest Issued); the last 7 days stay uninvoiced. Runs under the advisory lock `demo-window`, deterministic per (date, company) seed |
| **Autopilot** (`demoAutopilotUntil` per order, same cap for a whole drop) | Expected stage at `now`: units start at planned kitchen-ready −45 min, done at −5 min; drop dispatch-ready at planned dispatch-ready −10 min, out at planned dispatch-ready, delivered at deliveryAt −4 min (≈15 % late at +12 min). It advances orders up to the cap through the **same services** with system actor "Demo autopilot" and the scheduled timestamps. Caps for today: ~40 % `DELIVERED`, ~15 % `OUT_FOR_DELIVERY`, ~15 % `DISPATCH_READY`, ~15 % `KITCHEN_READY`, ~15 % none (fully manual). So at any hour every role has work left to do, and `driver@test.com` always has out-for-delivery drops. A human action on an order clears its cap (the human takes over) |
| **Close past days** | Nightly or catch-up: DEMO orders on past dates still below their cap are advanced to it, so history ends clean |
| **Regenerate** (`POST /demo/regenerate`) | Deletes `source = DEMO` orders (cascading lines, combinations, choices and events), drops left empty, invoices containing only DEMO orders, their adjustments, and `DemoDay` rows. Then runs `ensureWindow`. Reviewer-created (`STAFF`) data is kept |

---

## 13. Deployment and operations

### 13.1 Topology

```text
Reviewer browser ──HTTPS──▶ Vercel (Next.js, frontend)
                              │  rewrites /api/* (same-origin, first-party cookie)
                              ▼
                       Render free web service (NestJS, backend, Singapore, TZ=UTC)
                              │  pg (direct, pool max 5, TLS)
                              ▼
                       Neon Postgres 17 (Singapore, 0.25 CU, scale-to-zero 5 min)
UptimeRobot ──every 5 min──▶ GET /api/health on Render (no DB) ── keeps the API awake
```

### 13.2 Setup steps (P1, recorded in `vault/08 Knowledge/Environments and Deploy.md`)

1. **Neon:** create project `fernleaf-kitchen-ops` (Postgres 17, AWS Singapore). Set compute min = max = 0.25 CU. Create branches `dev` and `test`. Copy the direct connection strings.
2. **Render:**
   * New Web Service from the GitHub repo, region **Singapore**, plan **Free**, root = repo root.
   * Build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @fernleaf/backend... build && pnpm --filter @fernleaf/backend exec prisma migrate deploy`. The trailing `...` means "backend and its dependencies", so `shared` builds first.
   * Start: `pnpm --filter @fernleaf/backend start:prod`.
   * Health check path `/api/health`.
   * Env: §4.2 + `NODE_VERSION=22`.
3. **Vercel:** import the repo, Root Directory `frontend`, framework Next.js, Node 22. Build command `cd .. && pnpm --filter @fernleaf/frontend... build`. Env `API_ORIGIN`.
4. **Seed production once:** `DIRECT_DATABASE_URL=<main> pnpm --filter @fernleaf/backend db:seed`. Orders are generated by the API at boot (rolling window).
5. **UptimeRobot:** HTTP monitor on `https://<api>/api/health`, 5-minute interval. This keeps the instance warm; 744 h/month < the 750 free hours. **Keep only one free Render service in the workspace.**
6. **Smoke test** the live app with the checklist (four logins, role isolation, today's data, cut-off manual run, driver on a phone).

### 13.3 CI/CD

* **GitHub Actions** (`ci.yml`) on push and PR: `pnpm install --frozen-lockfile` → `pnpm -r lint` → `pnpm -r typecheck` → `pnpm -r test` → `pnpm -r build`. The domain tests run in a `TZ` matrix. Integration tests run when the `TEST_DATABASE_URL` secret is present.
* **Deploys:** Vercel and Render auto-deploy `main`. Migrations run in the Render build step; they are forward-only and additive.
* **Rollback:** Vercel instant rollback. On Render, redeploy the previous commit. DB changes are additive, so old code keeps working.

### 13.4 Keeping it alive for two weeks after submission

* The UptimeRobot monitor stays on, and its alert email goes to the owner.
* The rolling demo window runs automatically, with no manual steps.
* **Neon budget check** on day 3 and day 7 of review (Neon console → usage). If it trends above 80 %, switch the autopilot off in Settings.
* Do not push risky changes to `main` during review.

---

## 14. Known gotchas (also tracked in `vault/08 Knowledge/Gotchas.md`)

1. **Prisma 7** changes to watch:
   * `provider = "prisma-client"` with a mandatory `output`;
   * `moduleFormat = "cjs"` for Nest;
   * the URL lives in `prisma.config.ts`, and env vars are **not auto-loaded** there (import `dotenv/config`);
   * the driver adapter `@prisma/adapter-pg` is required;
   * import the client from the generated path;
   * **pin `prisma@^7`**.
2. **`@db.Date`** values are JS `Date` at UTC midnight. Only use `toDbDate` / `fromDbDate`.
3. **Next.js 16**: `middleware.ts` → **`proxy.ts`** (export `proxy`, Node runtime). Rewrites are resolved at build time, so `API_ORIGIN` must be set before building.
4. **Cookie through rewrites**: don't set `Domain`; `SameSite=Lax; Secure; HttpOnly; Path=/`.
5. **NestJS + Vitest**: decorators need `unplugin-swc`.
6. **Render free**: ephemeral filesystem, so never write uploads to disk. Spin-down after 15 min. 750 h/month is shared across the workspace.
7. **Neon free**: 100 CU-h/month and scale-to-zero after 5 min. `/api/health` must stay DB-free. Attach a `pool.on('error')` handler (idle connections are killed on suspend).
8. **Advisory locks**: transaction-scoped only (`pg_advisory_xact_lock`).
9. **CHECK constraints** are hand-written SQL. Review every new migration for unintended `DROP`.
10. **`updateManyAndReturn`** requires Prisma ≥ 6.2 (PostgreSQL).
11. **Workspace builds**: `shared` must build before the apps. `pnpm -r build` and `pnpm --filter <pkg>... build` already run in dependency order. The frontend may also use `transpilePackages: ['@fernleaf/shared']`.
12. **Express 5** (Nest 11) changed wildcard route syntax (`*splat`).
13. **Windows dev box**: `.gitattributes` with `* text=auto eol=lf`. Vault file names contain spaces, so quote paths in shells.
14. **Zod 4**: use `@hookform/resolvers` ≥ 5 and `nestjs-zod` ≥ 5.
15. **CASL + Prisma 7**: `@casl/prisma`'s default entry expects `@prisma/client` types, so wrap `@casl/prisma/runtime` with the generated client types. Build abilities only from permission codes, and keep rule conditions to simple equalities so the Prisma and Mongo abilities behave the same.

---

## 15. Technical risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Prisma 7 + Nest CJS setup friction | Medium | Follow the official Nest recipe (generator `moduleFormat = "cjs"`, adapter-pg). Time-box 45 min, then fall back to the ESM build of Nest |
| Free-tier limits during review | Medium | DB-frugal jobs, keep-alive, budget checks, autopilot switch |
| Kitchen board performance on 0.1 CPU Render | Low–Med | Single query, narrow select, measured with the perf script; cache per date for 5 s if needed |
| Time overrun on Musts | High | Phase checkpoints with cut lines (`vault/02 Phases/Phase Plan.md`); deploy early; no Shoulds before every Must works |
| CASL typing friction with Prisma 7 | Medium | Follow the README's runtime-wrapper recipe; time-box 45 min. Fallback: keep `@casl/ability` for checks and write the driver row filter by hand (one `where`) |
