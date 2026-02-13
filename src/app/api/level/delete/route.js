import { NextResponse } from "next/server";
import { requireSession } from "@/lib/firebase/requireSession";
import { db } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { success, user, response } = await requireSession();
    if (!success) return response;

    const userUid = user.uid;
    const userEmail = user.email;
    const userRoles = user.customClaims?.roles || user.roles || [];

    if (!userEmail) {
      return NextResponse.json(
        { success: false, message: "Invalid session." },
        { status: 401 }
      );
    }

    const { levelId, enteredPin } = await req.json();

    if (!levelId) {
      return NextResponse.json(
        { success: false, message: "Missing level id." },
        { status: 400 }
      );
    }

    const snapshot = await db.ref(`Level/${levelId}`).get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found." },
        { status: 404 }
      );
    }

    const levelData = snapshot.val();

    const storedPin = String(levelData.pin ?? "").trim();
    const enteredPinStr = String(enteredPin ?? "").trim();

    const isOwner = levelData.authorUid === userUid;
    const isAdmin =
      Array.isArray(userRoles) && userRoles.includes("admin");

    // If no PIN is set, allow anyone logged in
    const noPinSet = storedPin === "";

    if (!noPinSet) {
      const hasValidPin = storedPin === enteredPinStr;
      const hasAccess = hasValidPin || isOwner || isAdmin;

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, message: "Invalid PIN or unauthorized." },
          { status: 403 }
        );
      }
    }

    // Delete level
    await db.ref().update({
      [`LevelList/${levelId}`]: null,
      [`Level/${levelId}`]: null,
    });

    return NextResponse.json({
      success: true,
      message: "Level deleted successfully.",
    });

  } catch (error) {
    console.error("Delete level error:", error);

    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
