import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ success: true });
    }

    const auth = getAuth();
    const decodedClaims = await auth.verifySessionCookie(
      sessionCookie,
      true
    );

    await auth.revokeRefreshTokens(decodedClaims.uid);
    const res = NextResponse.json({ success: true });
    res.cookies.delete("session");

    return res;
    
  } catch (error) {
    console.error("Error revoking session:", error);
    const res = NextResponse.json({ success: false });
    res.cookies.delete("session");
    return res;
  }
}
