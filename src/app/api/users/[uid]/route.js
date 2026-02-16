import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase/requireSession";
import { auth } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

/**
 * PATCH /api/users/[uid]
 * 
 * Promotes or demotes a user to/from admin role.
 * Only accessible by admins.
 */
export async function PATCH(req, context) {
  // Ensure requester is an admin
  const { success, user, response } = await requireAdmin(req);
  if (!success) return response;

  try {

    const { uid } = await context.params; // Extract user ID from URL
    const body = await req.json();
    const action = body?.action; // Expect "promote" or "demote"

    if (!uid) {
      return NextResponse.json(
        { success: false, message: "UID required." },
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

    let roles = Array.isArray(currentClaims.roles)
      ? [...currentClaims.roles]
      : [];

    if (action === "promote") {
      if (!roles.includes("admin")) roles.push("admin");
    } else {
      roles = roles.filter((r) => r !== "admin");
    }

    await auth.setCustomUserClaims(uid, {
      ...currentClaims,
      roles,
    });

    return NextResponse.json({
      success: true,
      roles,
      message:
        action === "promote"
          ? "User promoted to admin."
          : "Admin rights revoked.",
    });

  } catch (err) {

    console.error(err);

    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );

  }

}

/**
 * DELETE /api/users/[uid]
 * 
 * Deletes a user from Firebase Auth.
 * Only accessible by admins and cannot delete self.
 */
export async function DELETE(req, context) {
  // Ensure requester is an admin
  const { success, user, response } = await requireAdmin(req);
  if (!success) return response;

  try {
    // Extract user ID from URL
    const { uid } = await context.params;

    if (!uid) {
      return NextResponse.json(
        { success: false, message: "UID required." },
        { status: 400 }
      );
    }

    if (uid === user.uid) {
      return NextResponse.json(
        { success: false, message: "You cannot delete yourself." },
        { status: 400 }
      );
    }

    await auth.deleteUser(uid);

    return NextResponse.json({
      success: true,
      message: "User deleted.",
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
