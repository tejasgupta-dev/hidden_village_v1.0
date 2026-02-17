import { NextResponse } from "next/server";

import { db } from "@/lib/firebase/firebaseAdmin";
import { requireAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const { success, response } = await requireAdmin(req);
  if (!success) return response;

  const playId = params?.id;
  if (!playId) {
    return NextResponse.json(
      { success: false, message: "Missing play id" },
      { status: 400 }
    );
  }

  const snap = await db.ref(`plays/${playId}`).once("value");

  if (!snap.exists()) {
    return NextResponse.json(
      { success: false, message: "Not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    play: snap.val(),
  });
}

export async function DELETE(req, { params }) {
  const { success, response } = await requireAdmin(req);
  if (!success) return response;

  const playId = params?.id;
  if (!playId) {
    return NextResponse.json(
      { success: false, message: "Missing play id" },
      { status: 400 }
    );
  }

  await db.ref(`plays/${playId}`).remove();

  return NextResponse.json({ success: true });
}
