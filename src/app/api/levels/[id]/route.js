import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

const isPlainObject = (v) =>
  !!v && typeof v === "object" && !Array.isArray(v);

const clamp = (n, min, max) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
};

function normalizeBool(v) {
  return v === true || v === "true";
}

function normalizeTFAnswer(v) {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return null;
}

function normalizePoseToleranceMap(v) {
  if (!isPlainObject(v)) return undefined; // undefined => don’t write
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    out[String(k)] = clamp(val, 0, 100);
  }
  return out;
}

// Whitelist + normalize fields you allow to be patched
function sanitizePatch(body) {
  const b = isPlainObject(body) ? body : {};

  const out = {};

  // common fields (keep what you already support)
  if (b.name !== undefined) out.name = String(b.name);
  if (b.keywords !== undefined) out.keywords = String(b.keywords);
  if (b.description !== undefined) out.description = String(b.description);
  if (b.question !== undefined) out.question = String(b.question);

  if (b.options !== undefined) out.options = Array.isArray(b.options) ? b.options.map((x) => String(x ?? "")) : [];
  if (b.answers !== undefined) out.answers = Array.isArray(b.answers) ? b.answers.map((x) => Number(x)).filter(Number.isFinite) : [];

  if (b.poses !== undefined) out.poses = isPlainObject(b.poses) ? b.poses : {};

  if (Object.prototype.hasOwnProperty.call(b, "isPublished")) {
    out.isPublished = normalizeBool(b.isPublished);
  }

  // ✅ PIN allowed IF client sends it (your permission logic gates who can do it)
  if (Object.prototype.hasOwnProperty.call(b, "pin")) {
    out.pin = String(b.pin ?? "");
  }

  // ✅ NEW: True/False gate
  if (Object.prototype.hasOwnProperty.call(b, "trueFalseEnabled")) {
    out.trueFalseEnabled = normalizeBool(b.trueFalseEnabled);
  }
  if (Object.prototype.hasOwnProperty.call(b, "trueFalseAnswer")) {
    out.trueFalseAnswer = normalizeTFAnswer(b.trueFalseAnswer);
  }

  // ✅ NEW: per-pose tolerance
  if (Object.prototype.hasOwnProperty.call(b, "poseTolerancePctById")) {
    const norm = normalizePoseToleranceMap(b.poseTolerancePctById);
    // if user sends garbage, store empty object (or skip). I prefer empty object.
    out.poseTolerancePctById = norm ?? {};
  }

  return out;
}

/**
 * GET /levels/[id]
 * (unchanged)
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

      if (!pinRequired) {
        const { pin, ...safeLevel } = level;
        return NextResponse.json({
          success: true,
          preview: false,
          hasPin: false,
          level: { id, ...safeLevel },
        });
      }

      if (!providedPin) {
        return NextResponse.json({
          success: true,
          preview: true,
          hasPin: true,
        });
      }

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

    // owner/admin bypass
    if (userIsOwner || userIsAdmin) {
      const { pin, ...safeLevel } = level;
      return NextResponse.json({
        success: true,
        preview: false,
        hasPin: pinRequired,
        level: { id, ...safeLevel },
      });
    }

    if (!pinRequired) {
      const { pin, ...safeLevel } = level;
      return NextResponse.json({
        success: true,
        preview: false,
        hasPin: false,
        level: { id, ...safeLevel },
      });
    }

    if (!providedPin) {
      return NextResponse.json({
        success: true,
        preview: true,
        hasPin: true,
      });
    }

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
 * (updated sanitizer)
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

    const pinRequired =
      typeof existing.pin === "string" && existing.pin.length > 0;
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
    const sanitized = sanitizePatch(body);

    const updates = {
      ...sanitized,
      updatedAt: Date.now(),
    };

    // Build LevelList mirror patch (menu)
    const levelListPatch = {};
    if (updates.name !== undefined) levelListPatch.name = updates.name;
    if (updates.author !== undefined) levelListPatch.author = updates.author;
    if (updates.authorUid !== undefined) levelListPatch.authorUid = updates.authorUid;
    if (updates.keywords !== undefined) levelListPatch.keywords = updates.keywords;
    if (updates.isPublished !== undefined) levelListPatch.isPublished = updates.isPublished;

    const multipath = {};
    for (const [key, value] of Object.entries(updates)) {
      multipath[`level/${id}/${key}`] = value;
    }
    for (const [key, value] of Object.entries(levelListPatch)) {
      multipath[`LevelList/${id}/${key}`] = value;
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
 * (unchanged)
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

    const pinRequired =
      typeof existing.pin === "string" && existing.pin.length > 0;
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
