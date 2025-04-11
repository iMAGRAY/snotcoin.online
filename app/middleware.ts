import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authService } from '@/app/services/auth/authService';
import { verify } from './utils/jwt';
import { ENV } from './lib/env';
import { AuthLogger } from "./utils/auth-logger";
import { AuthStep } from "./utils/auth-logger";

const logger = new AuthLogger(AuthStep.MIDDLEWARE);

// Всегда в режиме продакшена
const isProductionMode = true;

/**
 * Пути, которые не требуют аутентификации
 */
const publicPaths = [
  '/api/auth/providers/farcaster',
  '/api/frame',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/warpcast',
  '/api/health',
  '/'
];

/**
 * Защищенные пути API, которые требуют аутентификации
 */
const protectedApiPaths = [
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
 * Маршруты, защищенные авторизацией
 */
const protectedRoutes = [
  "/profile",
  "/profile/edit",
  "/favorites",
];

// Маршруты для перенаправления авторизованных пользователей
const authRoutes = [
  "/login",
  "/register",
];

/**
 * Middleware для проверки авторизации
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Если это API маршрут, пропускаем проверку авторизации
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Получаем токен из куки
  const token = request.cookies.get("token")?.value || null;
  
  logger.debug(`Path: ${pathname}, Token: ${token ? "exists" : "none"}`);

  // Проверяем токен
  let isAuthenticated = false;
  if (token) {
    try {
      const decodedToken = verify(token);
      isAuthenticated = decodedToken !== null;
      logger.debug(`Token verification: ${isAuthenticated ? "successful" : "failed"}`);
    } catch (error) {
      logger.error(`Token verification error: ${error instanceof Error ? error.message : String(error)}`);
      isAuthenticated = false;
    }
  }

  // Проверка защищенных маршрутов
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      logger.debug("Перенаправление неавторизованного пользователя на страницу входа");
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Перенаправление для авторизованных пользователей с авторизационных маршрутов
  if (isAuthenticated && authRoutes.some(route => pathname.startsWith(route))) {
    logger.info(`Redirecting authenticated user from auth route: ${pathname} to /profile`);
    return NextResponse.redirect(new URL("/profile", request.url));
  }

  return NextResponse.next();
}

/**
 * Настраиваем, какие маршруты обрабатывает middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

