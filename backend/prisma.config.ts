import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: the connection URL lives here, not in schema.prisma. The CLI (migrate, seed)
// uses the direct Neon endpoint; the running app connects through the pg driver adapter.
// `prisma generate` needs no database, so a missing URL must not fail CI/builds.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? '',
  },
});
