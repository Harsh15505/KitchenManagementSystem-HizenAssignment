import { type NextRequest, NextResponse } from 'next/server';

/** Name of the httpOnly session cookie issued by the API (TRD §5.4). */
export const SESSION_COOKIE = 'fl_session';

const PUBLIC_PATHS = ['/login'];

/**
 * Optimistic check only: no cookie → go to /login. This is NOT authorization; the API
 * verifies the session and permissions on every request (Next.js docs say the same).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (isPublic || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip the API proxy, Next.js internals and static files.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)',
  ],
};
