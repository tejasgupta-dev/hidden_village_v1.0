import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase/requireSession";
import { auth } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

// PATCH – Promote / Demote
export async function PATCH(req, context) {

  const { success, user, response } = await requireAdmin(req);
  if (!success) return response;

  try {

    const { uid } = await context.params;

    const body = await req.json();
    const action = body?.action;

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


export async function DELETE(req, context) {

  const { success, user, response } = await requireAdmin(req);
  if (!success) return response;

  try {

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
