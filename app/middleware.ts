import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken } from "./utils/jwt"

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Проверяем, является ли запрос API-запросом, требующим авторизации
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/') && 
    !request.nextUrl.pathname.startsWith('/api/auth/');

  if (isApiRequest) {
    // Получаем токен авторизации из заголовка
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : request.cookies.get('auth_token')?.value;

    // Если токен отсутствует, возвращаем ошибку
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Проверяем токен
    const { valid, error } = verifyToken(token);
    
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid token', details: error },
        { status: 401 }
      );
    }
  }

  // Remove X-Frame-Options header as we'll use CSP instead
  response.headers.delete("X-Frame-Options")

  // Set Content-Security-Policy to allow framing only from Telegram domains
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.telegram.org https://telegram.org https://*.telegram.me https://telegram.me",
  )

  return response
}

export const config = {
  matcher: "/:path*",
}

