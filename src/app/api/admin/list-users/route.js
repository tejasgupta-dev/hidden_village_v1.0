import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase/firebaseAdmin";
import { requireAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

export async function GET(req) {
  // Ensure the requester is authenticated and an admin
  const { success, user, response } = await requireAdmin(req);
  if (!success) return response;

  try {
    // List up to 1000 users
    const list = await auth.listUsers(1000);
    const users = list.users.map((u) => ({
      uid: u.uid,
      email: u.email,
      roles: u.customClaims?.roles || [],
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("Admin list error:", err);
    if (err.code === "auth/id-token-expired" || err.code === "auth/argument-error") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
