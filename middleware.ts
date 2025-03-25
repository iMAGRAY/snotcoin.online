import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Пути, которые не требуют авторизации
const publicPaths = ['/', '/api/auth', '/api/frame', '/error'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Пропускаем публичные пути
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Проверяем наличие сессии
  const session = request.cookies.get('session');
  
  if (!session) {
    // Если нет сессии, редиректим на страницу авторизации
    const authUrl = new URL('/api/auth', request.url);
    authUrl.searchParams.set('redirect', pathname);
    authUrl.searchParams.set('embed', 'true');
    
    return NextResponse.redirect(authUrl);
  }

  try {
    // Проверяем валидность сессии
    const sessionData = JSON.parse(session.value);
    if (!sessionData.isAuthenticated || !sessionData.fid) {
      throw new Error('Invalid session');
    }
  } catch (error) {
    // Если сессия невалидна, редиректим на страницу авторизации
    const authUrl = new URL('/api/auth', request.url);
    authUrl.searchParams.set('redirect', pathname);
    authUrl.searchParams.set('embed', 'true');
    
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 