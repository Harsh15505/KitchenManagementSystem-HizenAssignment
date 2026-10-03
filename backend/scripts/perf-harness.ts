/**
 * Shared harness for the perf (T-605) and concurrency (T-1206) scripts.
 *
 * Both run against a THROWAWAY Neon branch (ADR-029): the connection string lives in the
 * git-ignored `backend/.env.perf`. The harness starts the built API (`dist/main.js`) on port 4100
 * with that database, so every check goes through the real HTTP stack, then stops it.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';

/** The endpoint that serves the live app. Bulk scripts must never touch it. */
const LIVE_ENDPOINT = 'ep-autumn-forest-azgcpotr';
const PORT = 4100;
export const API = `http://localhost:${PORT}/api`;

export function loadPerfEnv(): Record<string, string> {
  const file = join(__dirname, '..', '.env.perf');
  if (!existsSync(file)) {
    throw new Error(
      'backend/.env.perf is missing. Create a Neon branch from `dev` and put its DATABASE_URL ' +
        '(and DIRECT_DATABASE_URL) there.',
    );
  }
  const env = parse(readFileSync(file));
  const url = env.DATABASE_URL ?? '';
  if (!url) throw new Error('backend/.env.perf has no DATABASE_URL.');
  if (url.includes(LIVE_ENDPOINT)) {
    throw new Error('backend/.env.perf points at the LIVE database. Use a throwaway branch.');
  }
  return env;
}

export async function startApi(env: Record<string, string>): Promise<ChildProcess> {
  const main = join(__dirname, '..', 'dist', 'main.js');
  if (!existsSync(main)) throw new Error('Run `pnpm --filter @fernleaf/backend build` first.');
  const local = parse(readFileSync(join(__dirname, '..', '.env')));
  const child = spawn(process.execPath, [main], {
    env: {
      ...process.env,
      ...local, // JWT_SECRET and the rest of the local config
      ...env, // the throwaway database
      DIRECT_DATABASE_URL: env.DIRECT_DATABASE_URL ?? env.DATABASE_URL,
      PORT: String(PORT),
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${API}/health/ready`);
      if (res.ok) return child;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  child.kill();
  throw new Error('The API did not become ready within 2 minutes.');
}

export interface Session {
  cookie: string;
  get<T>(path: string): Promise<T>;
  send(path: string, method: string, body?: unknown): Promise<Response>;
}

/** Signs in with a seeded test account (password from the seed) and returns a tiny client. */
export async function signIn(email: string): Promise<Session> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test@1234' }),
  });
  if (!res.ok) throw new Error(`Sign-in failed for ${email}: ${res.status}`);
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  const send = (path: string, method: string, body?: unknown) =>
    fetch(`${API}${path}`, {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    cookie,
    send,
    async get<T>(path: string) {
      const r = await send(path, 'GET');
      if (!r.ok) throw new Error(`GET ${path} → ${r.status} ${await r.text()}`);
      return (await r.json()) as T;
    },
  };
}

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, index)] ?? 0);
}
