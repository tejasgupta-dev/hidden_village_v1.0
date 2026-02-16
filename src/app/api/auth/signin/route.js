import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

/**
 * POST /api/auth/signin
 * 
 * Creates a Firebase session cookie for a user based on a provided ID token.
 * This allows the client to maintain a server-side session instead of only relying on client-side tokens.
 */
export async function POST(req) {
  try {
    // Parse JSON body safely; fallback to null if parsing fails
    const body = await req.json().catch(() => null);

    // Validate that a token was provided
    if (!body?.token) {
      return NextResponse.json(
        { success: false, message: "Token required" },
        { status: 400 }
      );
    }

    const { token } = body;
    // Verify the Firebase ID token to ensure it is valid and not expired
    await auth.verifyIdToken(token);
    const expiresIn = 60 * 60 * 24 * 1000;

    // Create a secure session cookie from the verified ID token
    const sessionCookie = await auth.createSessionCookie(token, {
      expiresIn,
    });

    const res = NextResponse.json({ success: true });

    res.cookies.set({
      name: "session", // Cookie name
      value: sessionCookie, // Cookie value (the session token)
      httpOnly: true, // Not accessible via JavaScript (XSS protection)
      secure: process.env.NODE_ENV === "production", // Only send over HTTPS in production
      sameSite: "lax", // Helps prevent CSRF attacks
      path: "/", // Cookie is available on all routes
      maxAge: expiresIn / 1000, // Cookie lifetime in seconds
    });

    return res;

  } catch (err) {
    console.error("Session login error:", err);

    return NextResponse.json(
      { success: false, message: "Authentication failed" },
      { status: 401 }
    );
  }
}
