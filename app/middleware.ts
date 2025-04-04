import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authService } from '@/app/services/auth/authService';
import { verifyJWT } from './utils/auth';
import { ENV, disableRedis } from './lib/env';
import { redisService } from './services/redis';
import { verify } from "./utils/jwt";
import { AuthLogger } from "./utils/auth-logger";
import { AuthStep } from "./utils/auth-logger";

const logger = new AuthLogger(AuthStep.MIDDLEWARE);

// Проверяем, включен ли режим имитации продакшена
const isProductionMode = process.env.USE_PRODUCTION_MODE === 'true' || process.env.NODE_ENV === 'production';

/**
 * Пути, которые не требуют аутентификации
 */
const publicPaths = [
  '/api/farcaster/auth',
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
  
  // Проверка, включен ли режим имитации продакшена в разработке
  const useProductionMode = process.env.USE_PRODUCTION_MODE === "true";
  const isDev = process.env.NODE_ENV === "development";
  
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

  // Если мы в режиме разработки и не используем режим имитации продакшена,
  // пропускаем защищенные маршруты даже без авторизации
  if (isDev && !useProductionMode && protectedRoutes.some(route => pathname.startsWith(route))) {
    logger.debug("Development mode: bypassing authentication for protected routes");
    return NextResponse.next();
  }

  // Перенаправление для неавторизованных пользователей с защищенных маршрутов
  if (!isAuthenticated && protectedRoutes.some(route => pathname.startsWith(route))) {
    logger.info(`Redirecting unauthenticated user from protected route: ${pathname} to /login`);
    return NextResponse.redirect(new URL("/login", request.url));
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

// Функция для инициализации и проверки сервисов
async function checkServices() {
  // Проверяем Redis
  try {
    if (ENV.REDIS_ENABLED) {
      const isAvailable = await redisService.isAvailable();
      if (!isAvailable) {
        console.warn('[Middleware] Redis недоступен, отключаем его использование');
        disableRedis();
      } else {
        console.log('[Middleware] Redis доступен и работает');
      }
    }
  } catch (error) {
    console.error('[Middleware] Ошибка при проверке Redis:', error);
    disableRedis();
  }
}

// Вызываем проверку сервисов при старте
checkServices().catch(error => {
  console.error('[Middleware] Ошибка при инициализации сервисов:', error);
});

