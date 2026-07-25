import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/** Routes that require a signed-in user. */
const PROTECTED_PREFIXES = ['/account', '/book', '/appointments'];

/** Routes that additionally require profiles.role === 'owner'. */
const ADMIN_PREFIX = '/admin';

function startsWithPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const needsAuth =
    PROTECTED_PREFIXES.some((p) => startsWithPrefix(pathname, p)) ||
    startsWithPrefix(pathname, ADMIN_PREFIX);

  if (!needsAuth) return response;

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (startsWithPrefix(pathname, ADMIN_PREFIX)) {
    // The user's own token can read their own profile row under RLS.
    const { data: profile } = await supabase!
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'owner') {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = '/';
      homeUrl.search = '';
      return NextResponse.redirect(homeUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * All request paths except static assets:
     * - _next/static, _next/image, favicon.ico
     * - common image/font files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
