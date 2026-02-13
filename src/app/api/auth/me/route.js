import { NextResponse } from "next/server";
import { requireSession } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

export async function GET() {
  const { success, user, response } = await requireSession();
  
  if (!success) {
    return response;
  }

  return NextResponse.json({
    user: {
      uid: user.uid,
      email: user.email,
      roles: user.customClaims?.roles || user.roles || [],
    },
  });
}