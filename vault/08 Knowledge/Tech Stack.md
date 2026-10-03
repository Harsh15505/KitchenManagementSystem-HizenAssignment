---
type: reference
updated: 2026-10-03 18:55 IST
---

# 🧰 Tech Stack

The full rationale is in `docs/TRD.md` §2 and [[Decision Log]]. Resolved versions checked against the `package.json` files on 2026-10-03 18:55.

| Layer | Package | Target | Resolved version | Notes |
|---|---|---|---|---|
| Runtime | Node.js | 22 LTS | 22.13.1 (local) | `.nvmrc`, `engines` |
| Package manager | pnpm workspaces (no Turborepo) | 10 | pnpm 10.33.0 (local) | `packageManager` field; `corepack enable` on Render; folders `frontend/`, `backend/`, `shared/` |
| Language | TypeScript | current stable (strict) | 6.0.3 | `noUncheckedIndexedAccess` |
| Frontend | next / react | 16.x / 19.x | 16.3.8 / 19.2.8 (create-next-app pin) | `proxy.ts`, App Router, rewrites |
| UI | tailwindcss / shadcn | 4.x / latest CLI | tailwind 4 · shadcn style `base-nova` (Base UI) | components in `frontend/src/components/ui` |
| Client data | @tanstack/react-query / react-table | 5 / 8 | query 5.104.1 · react-table **not used** (ADR-026: plain tables) | |
| Forms | react-hook-form / @hookform/resolvers | 7 / ≥ 5 | 7.89 / 5.9 | Zod 4 support |
| Backend | @nestjs/* | 11.x | 11.2.7 | Express 5 adapter |
| Validation | zod / nestjs-zod | 4.x / 5.x | 4.6.5 / 5.5.0 | shared schemas |
| Auth | @nestjs/jwt, cookie-parser, bcryptjs, @nestjs/throttler | latest | jwt 11.0 · bcryptjs 3.0 · throttler 6.7 | |
| Authorisation | @casl/ability · @casl/prisma · @casl/react | latest | 7.0.1 · 2.0.2 · 7.0.1 | abilities from permission codes; Prisma 7 runtime wrapper (ADR-023) |
| Jobs | in-process timers (`JobsService`) | — | no `@nestjs/schedule` | next cut-off timer + catch-up, no polling (ADR-013) |
| ORM | prisma / @prisma/client / @prisma/adapter-pg | **^7** (pin) | 7.10.0 | `prisma-client` generator, `moduleFormat = "cjs"` |
| DB | PostgreSQL (Neon) | 17 | Neon, ap-southeast-1 | Singapore |
| Dates | date-fns / @date-fns/tz | 4 / latest | 4.4.0 / 1.5.0 | `TZDate` |
| Tests | vitest / supertest | latest | vitest 5.0.3 · supertest 7.3 (no SWC: TS transpile plugin) | TZ matrix in CI |
| Lint | eslint / typescript-eslint / prettier | 9 / latest / 3 | 9.39 / 8.71 / 3.9 | flat config |
| UI extras | next-themes · tw-animate-css · lucide-react · sonner · @base-ui/react | latest | 0.4.6 · 1.4 · 1.50 · 2.0 · 1.8 | dark mode (ADR-028), animations, icons, toasts, primitives |
| Fonts | next/font/google | — | Geist (text), Geist Mono, Fraunces (headings) | ADR-028 |
