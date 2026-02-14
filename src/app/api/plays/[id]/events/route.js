import { NextResponse } from "next/server";

import { ref, push } from "firebase/database";

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

  const body =
    await req.json();

  const eventRef =
    push(ref(db, `plays/${params.playId}/eventData`));

  await eventRef.set({

    ...body,
    createdAt: Date.now()

  });

  return NextResponse.json({
    success: true
  });

}
