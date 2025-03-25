import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT, decodeToken } from '@/app/utils/jwt';

/**
 * Пути, которые не требуют аутентификации
 */
const publicPaths = [
  '/api/farcaster/auth',
  '/api/farcaster/neynar-auth',
  '/api/frame',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/health',
  '/auth',
  '/'
];

/**
 * Защищенные пути API, которые требуют аутентификации
 */
const protectedApiPaths = [
  '/api/game',
  '/api/user',
  // Добавьте другие защищенные пути API здесь
];

/**
 * Проверка, является ли запрос к API
 */
const isApiRequest = (pathname: string) => {
  return pathname.startsWith('/api/');
};

/**
 * Проверка, является ли путь публичным
 */
const isPublicPath = (pathname: string) => {
  return publicPaths.some(path => pathname.startsWith(path));
};

/**
 * Проверка, требует ли API путь аутентификации
 */
const isProtectedApiPath = (pathname: string) => {
  return protectedApiPaths.some(path => pathname.startsWith(path));
};

/**
 * Middleware для проверки авторизации
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Пропускаем публичные пути без проверки
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }
  
  // Проверяем, требует ли API путь аутентификации
  const isProtectedApi = isApiRequest(pathname) && isProtectedApiPath(pathname);
  
  // Если это не защищенный API, пропускаем
  if (isApiRequest(pathname) && !isProtectedApi) {
    return NextResponse.next();
  }
  
  // Получаем токен сессии из куки
  const sessionCookie = cookies().get('session');
  
  // Если токена нет, перенаправляем на страницу авторизации или возвращаем ошибку
  if (!sessionCookie) {
    if (isApiRequest(pathname)) {
      return NextResponse.json({
        success: false,
        message: 'Требуется авторизация'
      }, { status: 401 });
    } else {
      // Для обычных маршрутов перенаправляем на страницу авторизации
      // с указанием, куда вернуться после авторизации
      const url = new URL('/auth', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }
  
  try {
    // Проверяем JWT токен
    const { valid, userId, error } = await verifyJWT(sessionCookie.value);
    
    if (!valid || !userId) {
      // Пробуем получить refresh token
      const refreshTokenCookie = cookies().get('refresh_token');
      
      if (refreshTokenCookie) {
        // Если есть refresh token, перенаправляем на страницу авторизации
        // или возвращаем специальный ответ для API
        if (isApiRequest(pathname)) {
          return NextResponse.json({
            success: false,
            message: 'Токен истек',
            requiresRefresh: true
          }, { status: 401 });
        } else {
          // Для веб-страниц пусть клиент сам обрабатывает обновление токена
          // через FarcasterContext
          const url = new URL('/auth', request.url);
          url.searchParams.set('redirect', pathname);
          return NextResponse.redirect(url);
        }
      }
      
      // Если нет refresh token, удаляем куки сессии
      cookies().delete('session');
      
      // Возвращаем ошибку для API или перенаправляем на страницу авторизации
      if (isApiRequest(pathname)) {
        return NextResponse.json({
          success: false,
          message: 'Требуется авторизация',
          error
        }, { status: 401 });
      } else {
        const url = new URL('/auth', request.url);
        url.searchParams.set('redirect', pathname);
        return NextResponse.redirect(url);
      }
    }
    
    // Токен валиден, продолжаем запрос
    const response = NextResponse.next();
    
    // Добавляем идентификатор пользователя в заголовки запроса
    // для использования в API обработчиках
    response.headers.set('X-User-ID', userId);
    
    return response;
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // В случае ошибки удаляем куки сессии
    cookies().delete('session');
    
    if (isApiRequest(pathname)) {
      return NextResponse.json({
        success: false,
        message: 'Ошибка аутентификации',
        error: String(error)
      }, { status: 500 });
    } else {
      const url = new URL('/auth', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }
}

/**
 * Настраиваем, какие маршруты обрабатывает middleware
 */
export const config = {
  matcher: [
    /*
     * Матчим все маршруты, кроме:
     * - Файлов статики (изображения, шрифты, иконки и т.д.)
     * - Путей по умолчанию Next.js (_next)
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|images/|fonts/).*)',
  ],
};

