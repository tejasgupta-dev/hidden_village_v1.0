import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession, requireAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

/**
 * ADMIN ONLY: list all plays (metadata)
 */
export async function GET(req) {
  const { success, response } = await requireAdmin(req);
  if (!success) return response;

  const snap = await db.ref("plays").once("value");

  const result = [];
  snap.forEach((child) => {
    const val = child.val() || {};
    result.push({
      playId: child.key,
      ...(val.metadata || {}),
    });
  });

  return NextResponse.json({
    success: true,
    plays: result,
  });
}

/**
 * USER: create play session
 */
export async function POST(req) {
  const { success, response, user } = await requireSession(req);
  if (!success) return response;

  const body = await req.json().catch(() => ({}));
  const { gameId, levelId, deviceId } = body;

  if (!gameId || !levelId || !deviceId) {
    return NextResponse.json(
      { success: false, message: "Missing fields" },
      { status: 400 }
    );
  }

  const uid = user.uid;
  const timestamp = Date.now();

  const playRef = db.ref("plays").push();
  await playRef.set({
    metadata: {
      ownerUid: uid,
      gameId,
      levelId,
      deviceId,
      timestamp,
      createdAt: timestamp,
    },
  });

  return NextResponse.json({
    success: true,
    playId: playRef.key,
  });
}
