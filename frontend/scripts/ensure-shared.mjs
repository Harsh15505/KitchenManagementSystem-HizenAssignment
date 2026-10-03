// Builds @fernleaf/shared only when its output is missing (a fresh clone, e.g. on Vercel, which
// builds just this folder). In CI and locally `pnpm -r build` has already built it, and rebuilding
// here would race the parallel backend build: tsup cleans shared/dist before writing it.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const built = new URL('../../shared/dist/index.d.ts', import.meta.url);
if (existsSync(built)) {
  console.log('@fernleaf/shared already built');
} else {
  console.log('@fernleaf/shared not built yet: building it first');
  execSync('pnpm --filter @fernleaf/shared build', { stdio: 'inherit' });
}
