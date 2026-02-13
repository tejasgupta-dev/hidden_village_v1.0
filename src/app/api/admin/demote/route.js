import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase/requireSession";
import { auth } from "@/lib/firebase/firebaseAdmin";

export async function POST(req) {
  const { success, response } = await requireAdmin(req);
  if (!success) return response;

  try {
    const { uid } = await req.json();
    if (!uid) return NextResponse.json({ message: "UID required" }, { status: 400 });

    const userRecord = await auth.getUser(uid);
    const roles = (userRecord.customClaims?.roles || []).filter((r) => r !== "admin");

    await auth.setCustomUserClaims(uid, { ...userRecord.customClaims, roles });

    return NextResponse.json({ success: true, message: "Admin rights revoked" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
