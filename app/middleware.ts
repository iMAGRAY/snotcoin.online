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
    const { valid, expired } = verifyToken(token);
    
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid token', details: expired ? 'Token expired' : 'Invalid token' },
        { status: 401 }
      );
    }
  }

  // Remove X-Frame-Options header as we'll use CSP instead
  response.headers.delete("X-Frame-Options")

  // Set Content-Security-Policy to allow framing from any domain
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; frame-ancestors *; connect-src 'self' https: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.kaspersky-labs.com https://gc.kis.v2.scr.kaspersky-labs.com https://*.farcaster.xyz https://telegram.org https://*.telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  )

  return response
}

export const config = {
  matcher: "/:path*",
}

