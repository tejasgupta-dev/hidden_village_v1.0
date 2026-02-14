import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase/firebaseAdmin";
import { requireAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

export async function GET(req) {
  const { success, response } = await requireAdmin(req);
  if (!success) return response;

  try {
    const list = await auth.listUsers(1000);

    const users = list.users.map((u) => ({
      uid: u.uid,
      email: u.email ?? null,
      roles: Array.isArray(u.customClaims?.roles)
        ? u.customClaims.roles
        : [],
      disabled: u.disabled ?? false,
    }));

    return NextResponse.json({
      success: true,
      users,
    });

  } catch (err) {
    console.error("Admin list error:", err);

    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
