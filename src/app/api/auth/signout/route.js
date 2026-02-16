import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/**
 * POST /api/auth/signout
 * 
 * Logs out the current user by revoking their Firebase session cookie.
 * This ensures the session is invalidated on the server and removes the cookie from the client.
 */
export async function POST() {
  try {
    // Access the cookies sent with the request
    const cookieStore = cookies();

    // Get the current session cookie value
    const sessionCookie = cookieStore.get("session")?.value;

    // If there is no session cookie, user is already logged out
    if (!sessionCookie) {
      return NextResponse.json({ success: true });
    }

    // Firebase Admin Auth instance for managing users
    const auth = getAuth();

    // Verify the session cookie and decode its claims
    const decodedClaims = await auth.verifySessionCookie(
      sessionCookie,
      true
    );

    // Revoke all refresh tokens for the user to invalidate the session server-side
    await auth.revokeRefreshTokens(decodedClaims.uid);

    const res = NextResponse.json({ success: true });

    // Delete the session cookie from the client
    res.cookies.delete("session");

    return res;

  } catch (error) {
    console.error("Error revoking session:", error);
    const res = NextResponse.json({ success: false });
    res.cookies.delete("session");
    return res;
  }
}
