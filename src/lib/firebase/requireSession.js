/**
 * Session and authorization helpers.
 *
 * These functions are used in API routes to:
 *
 * 1. Verify the user is authenticated (requireSession)
 * 2. Verify the user is an admin (requireAdmin)
 * 3. Check admin role without enforcing it (isAdmin)
 *
 * This uses Firebase Admin SDK session cookies, which are:
 * - HttpOnly: cannot be accessed by JavaScript (prevents XSS theft)
 * - Signed: cannot be forged
 * - Verified server-side: cannot be spoofed
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "./firebaseAdmin";

/**
 * requireSession()
 *
 * Verifies that the request contains a valid Firebase session cookie.
 *
 * This is the primary authentication guard for protected API routes.
 *
 * 1. Read session cookie from request
 * 2. Verify cookie using Firebase Admin SDK
 * 3. Ensure required user fields exist
 * 4. Return decoded user if valid
 *
 * If invalid:
 * - Return 401 Unauthorized
 * - Clear invalid cookie
 *
 * Returns:
 * {
 *   success: true,
 *   user: decodedToken
 * }
 *
 * OR
 *
 * {
 *   success: false,
 *   response: NextResponse
 * }
 */
export async function requireSession() {
  try {
    // Access cookies from incoming request
    const cookieStore = await cookies();
    // Get Firebase session cookie
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return {
        success: false,
        response: NextResponse.json(
          { message: "Unauthorized" },
          { status: 401 }
        ),
      };
    }

    /**
     * Verify session cookie using Firebase Admin SDK
     *
     * The "true" argument enables revocation check.
     *
     * This ensures:
     * - Cookie is valid
     * - Cookie is signed by Firebase
     * - Cookie is not expired
     * - Cookie is not revoked
     */
    const decoded = await auth.verifySessionCookie(sessionCookie, true);

    /**
     * Validate required user identity fields.
     *
     * uid: unique Firebase user ID
     * email: verified email identity
     */
    if (!decoded.uid || !decoded.email) {
      return {
        success: false,
        response: NextResponse.json(
          { message: "Invalid session" },
          { status: 401 }
        ),
      };
    }

    return { success: true, user: decoded };
  } catch (err) {
    const res = NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
    res.cookies.set("session", "", { maxAge: 0, path: "/" });
    return { success: false, response: res };
  }
}

/**
 * requireAdmin()
 *
 * Enforces admin-only access to an endpoint.
 *
 * - Admin APIs
 * - Admin dashboards
 * - Protected management routes
 *
 * 1. Verify user is authenticated
 * 2. Check admin role
 * 3. Allow or deny access
 *
 * Returns:
 * success: true, user - if admin
 * success: false, response - if unauthorized or not admin
 */
export async function requireAdmin() {
  const { success, user, response } = await requireSession();
  if (!success) return { success, response };

  if (!isAdmin(user)) {
    return {
      success: false,
      response: NextResponse.json(
        { message: "Forbidden. Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { success: true, user };
}


/**
 * isAdmin(user)
 *
 * Checks whether a user has admin privileges.
 *
 * This function does NOT enforce access control.
 * It only checks the role.
 *
 * Use cases:
 * - Conditional UI rendering
 * - Feature flags
 * - Optional admin functionality
 *
 * IMPORTANT:
 * Never rely on this alone for security.
 * Always use requireAdmin() on protected API routes.
 *
 * Example user object:
 * {
 *   uid: "...",
 *   email: "...",
 *   roles: ["admin"]
 * }
 */
export function isAdmin(user) {
  return user?.roles && user.roles.includes("admin");
}