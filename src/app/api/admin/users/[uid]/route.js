import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase/requireSession";
import { auth } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

/* ===============================
   PATCH – Promote / Demote
================================ */
export async function PATCH(req, { params }) {
  const { success, user, response } = await requireAdmin(req);
  if (!success) return response;

  try {
    const { uid } = params;
    const { action } = await req.json(); // "promote" | "demote"

    if (!uid) {
      return NextResponse.json(
        { success: false, message: "Valid UID required." },
        { status: 400 }
      );
    }

    if (!["promote", "demote"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Invalid action." },
        { status: 400 }
      );
    }

    const userRecord = await auth.getUser(uid);
    const currentClaims = userRecord.customClaims || {};
    let roles = currentClaims.roles || [];

    if (action === "promote") {
      if (!roles.includes("admin")) roles.push("admin");
    }

    if (action === "demote") {
      roles = roles.filter((r) => r !== "admin");
    }

    await auth.setCustomUserClaims(uid, {
      ...currentClaims,
      roles,
    });

    return NextResponse.json({
      success: true,
      message:
        action === "promote"
          ? "User promoted to admin."
          : "Admin rights revoked.",
    });

  } catch (err) {
    console.error("Role update error:", err);

    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

/* ===============================
   DELETE – Remove User
================================ */
export async function DELETE(req, { params }) {
  const { success, user, response } = await requireAdmin(req);
  if (!success) return response;

  try {
    const { uid } = params;

    if (!uid) {
      return NextResponse.json(
        { success: false, message: "Valid UID required." },
        { status: 400 }
      );
    }

    // Prevent self-delete
    if (uid === user.uid) {
      return NextResponse.json(
        { success: false, message: "You cannot delete yourself." },
        { status: 400 }
      );
    }

    await auth.deleteUser(uid);

    return NextResponse.json({
      success: true,
      message: "User deleted successfully.",
    });

  } catch (err) {
    console.error("Delete user error:", err);

    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
