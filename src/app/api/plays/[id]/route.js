import { NextResponse } from "next/server";

import { ref, get, remove } from "firebase/database";

import { db } from "@/lib/firebase/firebaseClient";
import { requireAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";



export async function GET(req, { params }) {

  const { success, response } =
    await requireAdmin(req);

  if (!success) return response;

  const snap =
    await get(ref(db, `plays/${params.playId}`));

  if (!snap.exists())
    return NextResponse.json(
      { success: false, message: "Not found" },
      { status: 404 }
    );

  return NextResponse.json({

    success: true,
    play: snap.val()

  });

}



export async function DELETE(req, { params }) {

  const { success, response } =
    await requireAdmin(req);

  if (!success) return response;

  await remove(ref(db, `plays/${params.playId}`));

  return NextResponse.json({
    success: true
  });

}
