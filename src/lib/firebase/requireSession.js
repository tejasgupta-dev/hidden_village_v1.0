import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "./firebaseAdmin";

export async function requireSession() {
  try {
    const cookieStore = await cookies();
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

    const decoded = await auth.verifySessionCookie(sessionCookie, true);

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
 * Require user to be admin - use for admin-only endpoints.
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
 * Check if user has admin role - use for conditional admin features.
 */
export function isAdmin(user) {
  return user?.roles && user.roles.includes("admin");
}