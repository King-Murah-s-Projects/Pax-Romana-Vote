import { type NextRequest, NextResponse } from "next/server"
import { jwtVerify } from 'jose'

// Define your routes
const protectedRoutes = ["/vote", "/voting", "/dashboard", "/profile"]
const publicRoutes = ["/", "/about", "/contact", "/register", "/login"]
const authRoutes = ["/login", "/register"] // Routes that authenticated users shouldn't access

// JWT configuration
const secretKey = process.env.JWT_SECRET || 'your-secret-key'
const encodedKey = new TextEncoder().encode(secretKey)

async function verifyAuth(request: NextRequest): Promise<boolean> {
  try {
    // Try to get token from cookie first, then Authorization header
    const token = request.cookies.get('auth-token')?.value ||
        request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return false
    }

    // Verify JWT token
    await jwtVerify(token, encodedKey)
    return true
  } catch (error) {
    console.error('Auth verification failed:', error)
    return false
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  const isAuthRoute = authRoutes.some(route => path.startsWith(route))
  const isPublicRoute = publicRoutes.includes(path)

  // Verify authentication
  const isAuthenticated = await verifyAuth(request)

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    // Add redirect parameter to return user to original destination after login
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isAuthenticated) {
    // Check if there's a redirect parameter from login
    const redirectTo = request.nextUrl.searchParams.get('redirect') || '/voting'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  // Optional: Add user info to headers for server components
  if (isAuthenticated) {
    const response = NextResponse.next()
    // You could decode the JWT and add user info to headers here
    response.headers.set('x-authenticated', 'true')
    return response
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes except API routes, static files, and images
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Files with extensions (png, jpg, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/vote/:path*',
    '/admin/:path*'
  ],
}