import { NextResponse } from "next/server";
import { verifySession } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

export async function middleware(req) {
  const { cookies, nextUrl } = req;
  const session = cookies.get("session")?.value;

  const publicPaths = ["/auth/signIn", "/auth/signUp"];

  // Allow public paths
  if (publicPaths.some((path) => nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Redirect to sign in if no session
  if (!session) {
    const signInUrl = new URL("/auth/signIn", req.url);
    signInUrl.searchParams.set("redirect", nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  try {
    const decoded = await verifySession(session);
    const userRoles = decoded.customClaims?.roles || decoded.roles || [];

    // Check admin access for admin routes ONLY
    if (
      nextUrl.pathname.startsWith("/admin") &&
      !userRoles.includes("admin")
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // For /game/edit routes, just verify they have a valid session
    // PIN authorization is handled by the API and page component
    return NextResponse.next();
    
  } catch (err) {
    console.error("Middleware token error:", err);

    // Clear invalid session and redirect
    const signInUrl = new URL("/auth/signIn", req.url);
    signInUrl.searchParams.set("redirect", nextUrl.pathname);
    const response = NextResponse.redirect(signInUrl);
    response.cookies.set("session", "", { maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: [
    // Protected routes - require valid session
    "/admin/:path*",
    "/game/new",
    "/game/edit/:id*",  // ✅ Keep this - just check for valid session
    "/level/new",
    "/level/edit/:id*",
  ],
};