import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "./firebaseAdmin";

/**
 * Verify Firebase session cookie from request.
 * Returns { success, user, response }.
 */
export async function requireSession() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    console.log("🔍 Session check:", {
      hasCookie: !!sessionCookie,
      length: sessionCookie?.length || 0,
    });

    if (!sessionCookie) {
      console.log("❌ No session cookie found");
      return {
        success: false,
        response: NextResponse.json(
          { message: "Unauthorized" },
          { status: 401 }
        ),
      };
    }

    const decoded = await auth.verifySessionCookie(sessionCookie, true);

    console.log("✅ Session verified for:", decoded.email);

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
    console.error("❌ Session verification error:", err.code, err.message);
    const res = NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
    res.cookies.set("session", "", { maxAge: 0, path: "/" });
    return { success: false, response: res };
  }
}

/**
 * Require user to be admin.
 * Wraps requireSession() and checks roles.includes("admin").
 */
export async function requireAdmin() {
  const { success, user, response } = await requireSession();
  if (!success) return { success, response };

  if (!user.roles || !user.roles.includes("admin")) {
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