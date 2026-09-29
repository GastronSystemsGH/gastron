import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // 1. Proveravamo da li je aktivan Ghost Mode (impersonacija)
  const impersonatedUserId = request.cookies.get('impersonated_user_id')?.value;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  const url = request.nextUrl.clone();
  const protectedRoutes = ['/admin', '/restaurant', '/distributor', '/driver', '/dashboard'];
  const isProtectedRoute = protectedRoutes.some((route) => url.pathname.startsWith(route));

  // Ako je aktivan Ghost Mode, ne radimo restrikcije za login/redirekciju admina,
  // već dozvoljavamo pretraživaču da pristupi traženoj ruti.
  if (impersonatedUserId) {
    return supabaseResponse;
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (isProtectedRoute && !user) {
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (url.pathname === '/login' && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = (profile?.role || '').toLowerCase();

    if (role === 'admin' || role === 'superadmin') {
      url.pathname = '/admin';
    } else if (role === 'dis_driver' || role === 'driver' || role.includes('driver')) {
      url.pathname = '/driver';
    } else if (role.startsWith('dis_') || role.includes('distributor')) {
      url.pathname = '/distributor';
    } else {
      url.pathname = '/restaurant';
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/restaurant/:path*',
    '/distributor/:path*',
    '/driver/:path*',
    '/dashboard/:path*',
    '/login',
  ],
};