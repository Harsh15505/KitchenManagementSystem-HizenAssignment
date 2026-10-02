import type { NextConfig } from 'next';

// The browser only ever talks to this origin. /api/* is proxied to the NestJS API, so the
// session cookie is first-party and CORS stays off (ADR-003). Rewrites are resolved at build
// time: API_ORIGIN must be set in Vercel before deploying.
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
