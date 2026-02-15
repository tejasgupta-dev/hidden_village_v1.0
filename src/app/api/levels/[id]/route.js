import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

/* ===============================
   GET – Get Level (PIN protected)
================================ */
export async function GET(req, context) {
  // Require login
  const { success, user, response } = await requireSession();
  if (!success) return response;

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Level ID required." },
        { status: 400 }
      );
    }

    const ref = db.ref(`level/${id}`);
    const snapshot = await ref.get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found." },
        { status: 404 }
      );
    }

    const level = snapshot.val();

    // Check if PIN is required
    const pinRequired = level.pin && level.pin.length > 0;

    // Admins bypass PIN check
    if (pinRequired && !isAdmin(user)) {
      // Get pin from header or query
      const headerPin = req.headers.get("x-level-pin");
      const url = new URL(req.url);
      const queryPin = url.searchParams.get("pin");
      const providedPin = headerPin || queryPin;

      if (!providedPin) {
        console.log(`🔒 PIN required for level ${id}, none provided`);
        return NextResponse.json(
          {
            success: false,
            code: "PIN_REQUIRED",
            message: "PIN required to access this level.",
          },
          { status: 403 }
        );
      }

      if (providedPin !== level.pin) {
        console.log(`❌ Invalid PIN attempt for level ${id}`);
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_PIN",
            message: "Invalid PIN provided.",
          },
          { status: 403 }
        );
      }

      console.log(`✅ Valid PIN provided for level ${id}`);
    } else if (isAdmin(user)) {
      console.log(`👑 Admin ${user.email} bypassed PIN for level ${id}`);
    }

    // Hide pin from frontend
    const { pin, ...safeLevel } = level;

    return NextResponse.json({
      success: true,
      level: {
        id,
        ...safeLevel,
      },
    });
  } catch (err) {
    console.error("❌ GET /levels/[id] error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch level.",
      },
      { status: 500 }
    );
  }
}

/* ===============================
   PATCH/PUT – Update Level
================================ */
export async function PATCH(req, context) {
  const { success, user, response } = await requireSession();
  if (!success) return response;

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Level ID required." },
        { status: 400 }
      );
    }

    const ref = db.ref(`level/${id}`);
    const snapshot = await ref.get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found." },
        { status: 404 }
      );
    }

    const existingLevel = snapshot.val();

    // Check if user is owner or admin
    if (existingLevel.authorUid !== user.uid && !isAdmin(user)) {
      console.log(
        `🚫 User ${user.email} attempted to update level ${id} without permission`
      );
      return NextResponse.json(
        {
          success: false,
          message: "You don't have permission to update this level.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Fields that can be updated
    const {
      name,
      description,
      options,
      answers,
      keywords,
      pin,
      isPublished,
      poses,
    } = body;

    // Validate if fields are provided
    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return NextResponse.json(
        { success: false, message: "Valid name required." },
        { status: 400 }
      );
    }

    if (options !== undefined && !Array.isArray(options)) {
      return NextResponse.json(
        { success: false, message: "Options must be an array." },
        { status: 400 }
      );
    }

    if (answers !== undefined && !Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, message: "Answers must be an array." },
        { status: 400 }
      );
    }

    if (
      poses !== undefined &&
      (typeof poses !== "object" || poses === null || Array.isArray(poses))
    ) {
      return NextResponse.json(
        { success: false, message: "Poses must be an object." },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updates = {
      updatedAt: Date.now(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (options !== undefined) updates.options = options;
    if (answers !== undefined) updates.answers = answers;
    if (keywords !== undefined) updates.keywords = keywords;
    if (pin !== undefined) updates.pin = pin;
    if (isPublished !== undefined) updates.isPublished = isPublished;
    if (poses !== undefined) updates.poses = poses;

    await ref.update(updates);

    console.log(`✅ Level ${id} updated by ${user.email}`);

    // Get updated level
    const updatedSnapshot = await ref.get();
    const updatedLevel = updatedSnapshot.val();
    const { pin: _, ...safeLevel } = updatedLevel;

    return NextResponse.json({
      success: true,
      level: {
        id,
        ...safeLevel,
      },
    });
  } catch (err) {
    console.error("❌ PATCH /levels/[id] error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update level.",
      },
      { status: 500 }
    );
  }
}

/* ===============================
   DELETE – Delete Level
================================ */
export async function DELETE(req, context) {
  const { success, user, response } = await requireSession();
  if (!success) return response;

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Level ID required." },
        { status: 400 }
      );
    }

    const ref = db.ref(`level/${id}`);
    const snapshot = await ref.get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found." },
        { status: 404 }
      );
    }

    const level = snapshot.val();

    // Check if user is owner or admin
    if (level.authorUid !== user.uid && !isAdmin(user)) {
      console.log(
        `🚫 User ${user.email} attempted to delete level ${id} without permission`
      );
      return NextResponse.json(
        {
          success: false,
          message: "You don't have permission to delete this level.",
        },
        { status: 403 }
      );
    }

    await ref.remove();

    console.log(`🗑️ Level ${id} deleted by ${user.email}`);

    return NextResponse.json({
      success: true,
      message: "Level deleted successfully.",
    });
  } catch (err) {
    console.error("❌ DELETE /levels/[id] error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete level.",
      },
      { status: 500 }
    );
  }
}