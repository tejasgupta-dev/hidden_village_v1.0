import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

/*
Modes supported:

1. Preview mode (no pin required)
2. Access mode (pin provided)
3. Update mode (owner/admin/pin)
4. Delete mode (owner/admin/pin)
*/


/* ===============================
   Helper: check admin
================================ */
function isAdmin(user) {
  return (
    user?.roles?.includes("admin") ||
    user?.customClaims?.roles?.includes("admin")
  );
}


/* ===============================
   GET – Preview or Access Level
================================ */
export async function GET(req, context) {
  try {
    const id = await context?.params?.id;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Level ID required" },
        { status: 400 }
      );
    }

    const levelSnap = await db.ref(`level/${id}`).get();

    if (!levelSnap.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found" },
        { status: 404 }
      );
    }

    const level = levelSnap.val();

    const hasPin =
      typeof level.pin === "string" &&
      level.pin.length > 0;

    const providedPin = req.headers.get("x-level-pin");

    // Preview mode
    if (!providedPin) {
      return NextResponse.json({
        success: true,
        preview: true,
        hasPin,
      });
    }

    // Incorrect PIN
    if (hasPin && providedPin !== level.pin) {
      return NextResponse.json(
        {
          success: false,
          message: "Incorrect PIN",
          hasPin: true,
        },
        { status: 403 }
      );
    }

    // Access granted
    const { pin, ...safeLevel } = level;

    return NextResponse.json({
      success: true,
      preview: false,
      hasPin,
      level: {
        id,
        ...safeLevel,
      },
    });

  } catch (err) {
    console.error("GET level error:", err);

    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}


/* ===============================
   PATCH – Update Level
================================ */
export async function PATCH(req, context) {

  const { success, user, response } = await requireSession(req);
  if (!success) return response;

  try {

    const id = context?.params?.id;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Level ID required" },
        { status: 400 }
      );
    }

    const ref = db.ref(`level/${id}`);
    const snapshot = await ref.get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found" },
        { status: 404 }
      );
    }

    const existingLevel = snapshot.val();

    const pinRequired =
      typeof existingLevel.pin === "string" &&
      existingLevel.pin.length > 0;

    let hasPermission = false;

    // Owner or admin
    if (
      existingLevel.authorUid === user.uid ||
      isAdmin(user)
    ) {
      hasPermission = true;
    }

    // PIN access
    else if (pinRequired) {

      const providedPin =
        req.headers.get("x-level-pin");

      if (!providedPin) {
        return NextResponse.json(
          {
            success: false,
            code: "PIN_REQUIRED",
            message: "PIN required",
          },
          { status: 403 }
        );
      }

      if (providedPin !== existingLevel.pin) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_PIN",
            message: "Invalid PIN",
          },
          { status: 403 }
        );
      }

      hasPermission = true;
    }

    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden",
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    const updates = {
      ...body,
      updatedAt: Date.now(),
    };

    await ref.update(updates);

    const updatedSnapshot = await ref.get();
    const updatedLevel = updatedSnapshot.val();

    const { pin, ...safeLevel } = updatedLevel;

    return NextResponse.json({
      success: true,
      level: {
        id,
        ...safeLevel,
      },
    });

  } catch (err) {

    console.error("PATCH level error:", err);

    return NextResponse.json(
      {
        success: false,
        message: err.message,
      },
      { status: 500 }
    );
  }
}


/* ===============================
   DELETE – Delete Level
================================ */
export async function DELETE(req, context) {

  const { success, user, response } = await requireSession(req);
  if (!success) return response;

  try {

    const id = context?.params?.id;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Level ID required" },
        { status: 400 }
      );
    }

    const ref = db.ref(`level/${id}`);
    const snapshot = await ref.get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found" },
        { status: 404 }
      );
    }

    const level = snapshot.val();

    const pinRequired =
      typeof level.pin === "string" &&
      level.pin.length > 0;

    let hasPermission = false;

    if (
      level.authorUid === user.uid ||
      isAdmin(user)
    ) {
      hasPermission = true;
    }

    else if (pinRequired) {

      const providedPin =
        req.headers.get("x-level-pin");

      if (!providedPin) {
        return NextResponse.json(
          {
            success: false,
            code: "PIN_REQUIRED",
            message: "PIN required",
          },
          { status: 403 }
        );
      }

      if (providedPin !== level.pin) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_PIN",
            message: "Invalid PIN",
          },
          { status: 403 }
        );
      }

      hasPermission = true;
    }

    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden",
        },
        { status: 403 }
      );
    }

    await ref.remove();

    return NextResponse.json({
      success: true,
      message: "Level deleted",
    });

  } catch (err) {

    console.error("DELETE level error:", err);

    return NextResponse.json(
      {
        success: false,
        message: err.message,
      },
      { status: 500 }
    );
  }
}
