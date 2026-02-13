import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);

    if (!body?.token) {
      return NextResponse.json(
        { success: false, message: "Token required" },
        { status: 400 }
      );
    }

    const { token } = body;
    await auth.verifyIdToken(token);
    const expiresIn = 60 * 60 * 24 * 1000;

    // Create session cookie
    const sessionCookie = await auth.createSessionCookie(token, {
      expiresIn,
    });

    const res = NextResponse.json({ success: true });

    res.cookies.set({
      name: "session",
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn / 1000,
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
