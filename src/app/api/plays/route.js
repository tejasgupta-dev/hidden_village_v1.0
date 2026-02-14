import { NextResponse } from "next/server";
import { ref, push, set, get } from "firebase/database";

import { db } from "@/lib/firebase/firebaseClient";
import { requireSession, requireAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";



/**
 * ADMIN ONLY
 */
export async function GET(req) {

  const { success, response } =
    await requireAdmin(req);

  if (!success) return response;

  const snap = await get(ref(db, "plays"));

  const result = [];

  snap.forEach(child => {

    result.push({
      playId: child.key,
      ...child.val().metadata
    });

  });

  return NextResponse.json({
    success: true,
    plays: result
  });

}



/**
 * USER create session
 */
export async function POST(req) {

  const { success, response, session } =
    await requireSession(req);

  if (!success) return response;

  const uid = session.uid;

  const body = await req.json();

  const {
    gameId,
    levelId,
    deviceId
  } = body;

  if (!gameId || !levelId || !deviceId)
    return NextResponse.json(
      { success: false, message: "Missing fields" },
      { status: 400 }
    );

  const playRef =
    push(ref(db, "plays"));

  const timestamp =
    Date.now();

  await set(playRef, {

    metadata: {

      ownerUid: uid,
      gameId,
      levelId,
      deviceId,
      timestamp,
      createdAt: timestamp

    }

  });

  return NextResponse.json({

    success: true,
    playId: playRef.key

  });

}
