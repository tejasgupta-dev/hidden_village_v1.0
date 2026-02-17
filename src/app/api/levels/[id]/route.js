import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

/**
 * GET /levels/[id]
 * Modes:
 *  - mode=play: public access to published levels; PIN enforced if level has a pin
 *  - default (edit): requires session; owner/admin bypasses PIN; others use preview flow
 */
export async function GET(req, context) {
  try {
    const params = await context.params;
    const id = params?.id || params?.levelId;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Level ID required." },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");

    const snap = await db.ref(`level/${id}`).get();
    if (!snap.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found." },
        { status: 404 }
      );
    }

    const level = snap.val();

    const pinRequired = typeof level.pin === "string" && level.pin.length > 0;
    const providedPin = req.headers.get("x-level-pin");

    /* ---------------- PLAY MODE (public) ---------------- */
    if (mode === "play") {
      if (!level.isPublished) {
        return NextResponse.json(
          { success: false, message: "Level is not published." },
          { status: 403 }
        );
      }

      // If no pin, return safe level
      if (!pinRequired) {
        const { pin, ...safeLevel } = level;
        return NextResponse.json({
          success: true,
          preview: false,
          hasPin: false,
          level: { id, ...safeLevel },
        });
      }

      // Pin exists: if none provided -> preview
      if (!providedPin) {
        return NextResponse.json({
          success: true,
          preview: true,
          hasPin: true,
        });
      }

      // Pin exists: incorrect
      if (providedPin !== level.pin) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_PIN",
            message: "Invalid PIN",
            hasPin: true,
          },
          { status: 403 }
        );
      }

      // Pin correct -> return safe level
      const { pin, ...safeLevel } = level;
      return NextResponse.json({
        success: true,
        preview: false,
        hasPin: true,
        level: { id, ...safeLevel },
      });
    }

    /* ---------------- EDIT / DEFAULT MODE (authed) ---------------- */
    const { success, user, response } = await requireSession();
    if (!success) return response;

    const userIsAdmin = isAdmin(user);
    const userIsOwner = level.authorUid === user.uid;

    // ✅ owner/admin bypass pin completely (even if hasPin true)
    if (userIsOwner || userIsAdmin) {
      const { pin, ...safeLevel } = level;
      return NextResponse.json({
        success: true,
        preview: false,
        hasPin: pinRequired,
        level: { id, ...safeLevel },
      });
    }

    // if no pin -> any authed user can access
    if (!pinRequired) {
      const { pin, ...safeLevel } = level;
      return NextResponse.json({
        success: true,
        preview: false,
        hasPin: false,
        level: { id, ...safeLevel },
      });
    }

    // pin exists: no pin header -> preview
    if (!providedPin) {
      return NextResponse.json({
        success: true,
        preview: true,
        hasPin: true,
      });
    }

    // pin exists: incorrect
    if (providedPin !== level.pin) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_PIN",
          message: "Invalid PIN",
          hasPin: true,
        },
        { status: 403 }
      );
    }

    // correct pin -> return safe level
    const { pin, ...safeLevel } = level;
    return NextResponse.json({
      success: true,
      preview: false,
      hasPin: true,
      level: { id, ...safeLevel },
    });
  } catch (err) {
    console.error("GET /levels/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch level." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /levels/[id]
 * Permissions:
 *  - owner/admin always allowed
 *  - if PIN exists -> must provide correct x-level-pin for non-owner/admin
 *  - if NO PIN exists -> allowed for any authenticated user
 *
 * Mirrors menu fields to LevelList/{id}
 */
export async function PATCH(req, context) {
  const { success, user, response } = await requireSession();
  if (!success) return response;

  try {
    const params = await context.params;
    const id = params?.id || params?.levelId;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Level ID required." },
        { status: 400 }
      );
    }

    const ref = db.ref(`level/${id}`);
    const snap = await ref.get();
    if (!snap.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found." },
        { status: 404 }
      );
    }

    const existing = snap.val();

    const userIsAdmin = isAdmin(user);
    const userIsOwner = existing.authorUid === user.uid;

    const pinRequired = typeof existing.pin === "string" && existing.pin.length > 0;
    const providedPin = req.headers.get("x-level-pin");

    if (!(userIsOwner || userIsAdmin)) {
      if (pinRequired) {
        if (!providedPin) {
          return NextResponse.json(
            { success: false, code: "PIN_REQUIRED", message: "PIN required" },
            { status: 403 }
          );
        }
        if (providedPin !== existing.pin) {
          return NextResponse.json(
            { success: false, code: "INVALID_PIN", message: "Invalid PIN" },
            { status: 403 }
          );
        }
      }
    }

    const body = await req.json();

    // normalize isPublished boolean if it might arrive as string
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

    const updatedSnap = await db.ref(`level/${id}`).get();
    const updated = updatedSnap.val();

    const { pin, ...safeLevel } = updated;

    return NextResponse.json({
      success: true,
      level: { id, ...safeLevel },
    });
  } catch (err) {
    console.error("PATCH /levels/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to update level." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /levels/[id]
 * Same permission rules as PATCH.
 */
export async function DELETE(req, context) {
  const { success, user, response } = await requireSession();
  if (!success) return response;

  try {
    const params = await context.params;
    const id = params?.id || params?.levelId;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Level ID required." },
        { status: 400 }
      );
    }

    const ref = db.ref(`level/${id}`);
    const snap = await ref.get();
    if (!snap.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found." },
        { status: 404 }
      );
    }

    const existing = snap.val();

    const userIsAdmin = isAdmin(user);
    const userIsOwner = existing.authorUid === user.uid;

    const pinRequired = typeof existing.pin === "string" && existing.pin.length > 0;
    const providedPin = req.headers.get("x-level-pin");

    if (!(userIsOwner || userIsAdmin)) {
      if (pinRequired) {
        if (!providedPin) {
          return NextResponse.json(
            { success: false, code: "PIN_REQUIRED", message: "PIN required" },
            { status: 403 }
          );
        }
        if (providedPin !== existing.pin) {
          return NextResponse.json(
            { success: false, code: "INVALID_PIN", message: "Invalid PIN" },
            { status: 403 }
          );
        }
      }
    }

    await db.ref().update({
      [`level/${id}`]: null,
      [`LevelList/${id}`]: null,
    });

    return NextResponse.json({ success: true, message: "Level deleted" });
  } catch (err) {
    console.error("DELETE /levels/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to delete level." },
      { status: 500 }
    );
  }
}
