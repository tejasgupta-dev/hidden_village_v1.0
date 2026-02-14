import { NextResponse } from "next/server";

import { ref, update } from "firebase/database";

import { db } from "@/lib/firebase/firebaseClient";

import { requireSession } from "@/lib/firebase/requireSession";
import { requirePlayOwner } from "@/lib/firebase/requirePlayOwner";

export const runtime = "nodejs";


export async function POST(req, { params }) {

  const { success, response, session } =
    await requireSession(req);

  if (!success) return response;

  const isOwner =
    await requirePlayOwner(params.playId, session.uid);

  if (!isOwner)
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 }
    );

  const {
    frames,
    startIndex
  } = await req.json();

  const updates = {};

  frames.forEach((frame, i) => {

    updates[
      `plays/${params.playId}/poseData/${startIndex + i}`
    ] = frame;

  });

  await update(ref(db), updates);

  return NextResponse.json({
    success: true,
    nextIndex: startIndex + frames.length
  });

}
