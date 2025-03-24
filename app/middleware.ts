import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

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

