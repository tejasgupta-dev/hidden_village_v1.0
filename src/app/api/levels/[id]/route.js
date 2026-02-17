import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

/**
 * GET – Fetch Level
 * - If NO PIN exists → return full level data (no header needed)
 * - If PIN exists and no PIN header → return preview only
 * - If PIN exists and incorrect → deny access
 * - If PIN exists and correct → return full level data
 * - PIN is NEVER returned to client
 */
export async function GET(req, context) {
  try {
    const params = await context.params;
    const id = params.id || params.levelId;

    if (!id || id === "") {
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

    const hasPin = typeof level.pin === "string" && level.pin.length > 0;
    const providedPin = req.headers.get("x-level-pin");

    // ✅ If no PIN exists, return full level without any header
    if (!hasPin) {
      const { pin, ...safeLevel } = level;
      return NextResponse.json({
        success: true,
        preview: false,
        hasPin: false,
        level: {
          id,
          ...safeLevel,
        },
      });
    }

    // Preview mode when PIN exists but wasn't provided
    if (!providedPin) {
      return NextResponse.json({
        success: true,
        preview: true,
        hasPin: true,
      });
    }

    // Incorrect PIN
    if (providedPin !== level.pin) {
      return NextResponse.json(
        { success: false, message: "Incorrect PIN", hasPin: true },
        { status: 403 }
      );
    }

    // Access granted
    const { pin, ...safeLevel } = level;

    return NextResponse.json({
      success: true,
      preview: false,
      hasPin: true,
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

/**
 * PATCH – Update Level
 * Rules:
 * - If NO PIN exists → ✅ any logged-in user can update (public edit)
 * - If PIN exists → owner/admin OR valid PIN required
 *
 * Also mirrors menu fields to LevelList/{id} so the UI list stays correct.
 */
export async function PATCH(req, context) {
  const { success, user, response } = await requireSession(req);
  if (!success) return response;

  try {
    const params = await context.params;
    const id = params.id || params.levelId;

    if (!id || id === "") {
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
      typeof existingLevel.pin === "string" && existingLevel.pin.length > 0;

    // ✅ Permission rules
    let hasPermission = false;

    // Public edit if no pin exists
    if (!pinRequired) {
      hasPermission = true;
    }
    // Owner/admin always allowed
    else if (existingLevel.authorUid === user.uid || isAdmin(user)) {
      hasPermission = true;
    }
    // Otherwise require valid PIN
    else {
      const providedPin = req.headers.get("x-level-pin");

      if (!providedPin) {
        return NextResponse.json(
          { success: false, code: "PIN_REQUIRED", message: "PIN required" },
          { status: 403 }
        );
      }

      if (providedPin !== existingLevel.pin) {
        return NextResponse.json(
          { success: false, code: "INVALID_PIN", message: "Invalid PIN" },
          { status: 403 }
        );
      }

      hasPermission = true;
    }

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Normalize isPublished if it might come as "true"/"false"
    const normalizedBody = {
      ...body,
      ...(Object.prototype.hasOwnProperty.call(body, "isPublished") && {
        isPublished: body.isPublished === true || body.isPublished === "true",
      }),
    };

    const updates = {
      ...normalizedBody,
      updatedAt: Date.now(),
    };

    // Mirror only menu fields into LevelList
    const levelListPatch = {};
    if (updates.name !== undefined) levelListPatch.name = updates.name;
    if (updates.author !== undefined) levelListPatch.author = updates.author;
    if (updates.authorUid !== undefined) levelListPatch.authorUid = updates.authorUid;
    if (updates.keywords !== undefined) levelListPatch.keywords = updates.keywords;
    if (updates.isPublished !== undefined) levelListPatch.isPublished = updates.isPublished;

    const multipath = {
      [`level/${id}`]: updates,
    };

    if (Object.keys(levelListPatch).length > 0) {
      multipath[`LevelList/${id}`] = levelListPatch;
    }

    await db.ref().update(multipath);

    const updatedSnapshot = await db.ref(`level/${id}`).get();
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
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE – Delete Level
 * Rules:
 * - If NO PIN exists → ✅ any logged-in user can delete (public delete)
 * - If PIN exists → owner/admin OR valid PIN required
 *
 * Deletes from both `level/{id}` and `LevelList/{id}`.
 */
export async function DELETE(req, context) {
  const { success, user, response } = await requireSession(req);
  if (!success) return response;

  try {
    const params = await context.params;
    const id = params.id || params.levelId;

    if (!id || id === "") {
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
    const pinRequired = typeof level.pin === "string" && level.pin.length > 0;

    // ✅ Permission rules
    let hasPermission = false;

    // Public delete if no pin exists
    if (!pinRequired) {
      hasPermission = true;
    }
    // Owner/admin always allowed
    else if (level.authorUid === user.uid || isAdmin(user)) {
      hasPermission = true;
    }
    // Otherwise require valid PIN
    else {
      const providedPin = req.headers.get("x-level-pin");

      if (!providedPin) {
        return NextResponse.json(
          { success: false, code: "PIN_REQUIRED", message: "PIN required" },
          { status: 403 }
        );
      }

      if (providedPin !== level.pin) {
        return NextResponse.json(
          { success: false, code: "INVALID_PIN", message: "Invalid PIN" },
          { status: 403 }
        );
      }

      hasPermission = true;
    }

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    await db.ref().update({
      [`level/${id}`]: null,
      [`LevelList/${id}`]: null,
    });

    return NextResponse.json({
      success: true,
      message: "Level deleted",
    });
  } catch (err) {
    console.error("DELETE level error:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
