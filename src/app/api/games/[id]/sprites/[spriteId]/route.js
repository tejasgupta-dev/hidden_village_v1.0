// app/games/[id]/sprites/[spriteId]/route.js
import { NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

async function assertGameWriteAccess({ gameId, req, user }) {
  const snap = await db.ref(`Games/${gameId}`).get();

  if (!snap.exists()) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, message: "Game not found." },
        { status: 404 }
      ),
    };
  }

  const game = snap.val();
  const userIsAdmin = isAdmin(user);
  const isOwner = game.authorUid === user.uid;

  const pinRequired = typeof game.pin === "string" && game.pin.length > 0;
  const providedPin = req.headers.get("x-game-pin");

  // Owner/admin always allowed
  if (isOwner || userIsAdmin) return { ok: true, game };

  // If PIN exists, enforce it
  if (pinRequired) {
    if (!providedPin) {
      return {
        ok: false,
        res: NextResponse.json(
          { success: false, code: "PIN_REQUIRED", message: "PIN required" },
          { status: 403 }
        ),
      };
    }

    if (providedPin !== game.pin) {
      return {
        ok: false,
        res: NextResponse.json(
          { success: false, code: "INVALID_PIN", message: "Invalid PIN" },
          { status: 403 }
        ),
      };
    }
  }

  // If no PIN -> allow any authed user (matches your other routes’ behavior)
  return { ok: true, game };
}

export async function DELETE(req, context) {
  const { success, user, response } = await requireSession();
  if (!success) return response;

  try {
    const { id, spriteId } = await context.params;

    if (!id || !spriteId) {
      return NextResponse.json(
        { success: false, message: "Game ID and sprite ID required." },
        { status: 400 }
      );
    }

    const access = await assertGameWriteAccess({ gameId: id, req, user });
    if (!access.ok) return access.res;

    const metaSnap = await db.ref(`Games/${id}/sprites/${spriteId}`).get();
    if (!metaSnap.exists()) {
      return NextResponse.json(
        { success: false, message: "Sprite not found." },
        { status: 404 }
      );
    }

    const meta = metaSnap.val();

    // Delete file from storage (if storage is configured)
    if (storage && meta?.path) {
      await storage.file(meta.path).delete({ ignoreNotFound: true });
    }

    // Delete metadata
    await db.ref(`Games/${id}/sprites/${spriteId}`).remove();
    await db.ref(`Games/${id}/updatedAt`).set(Date.now());

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /games/[id]/sprites/[spriteId] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to delete sprite." },
      { status: 500 }
    );
  }
}