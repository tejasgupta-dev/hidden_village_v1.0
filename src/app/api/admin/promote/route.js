import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase/requireSession";
import { promoteToAdmin } from "@/lib/firebase/firebaseAdmin";

export async function POST(req) {
  // Check admin access
  const { success, user, response } = await requireAdmin(req);
  if (!success) return response;

  try {
    const { uid } = await req.json();
    if (!uid || typeof uid !== "string") {
      return NextResponse.json({ message: "Valid UID required." }, { status: 400 });
    }
    
    await promoteToAdmin(uid);

    return NextResponse.json({ success: true, message: "User promoted to admin!" });
  } catch (err) {
    console.error("Promote admin error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
