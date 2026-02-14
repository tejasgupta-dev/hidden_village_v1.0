import { NextResponse } from "next/server";

import { ref, get, set } from "firebase/database";

import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

import { db, storage } from "@/lib/firebase/firebaseClient";

import { requireSession } from "@/lib/firebase/requireSession";
import { requirePlayOwner } from "@/lib/firebase/requirePlayOwner";

export const runtime = "nodejs";


export async function POST(req, { params }) {

  const { success, response, session } =
    await requireSession(req);

  if (!success) return response;

  const uid =
    session.uid;

  const isOwner =
    await requirePlayOwner(params.playId, uid);

  if (!isOwner)
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 }
    );


  const form =
    await req.formData();

  const video =
    form.get("video");

  if (!video)
    return NextResponse.json(
      { success: false, message: "Missing video" },
      { status: 400 }
    );


  const metaSnap =
    await get(ref(db, `plays/${params.playId}/metadata`));

  const meta =
    metaSnap.val();

  const storagePath =
    `plays/${meta.gameId}/${meta.levelId}/${meta.ownerUid}/${meta.deviceId}/${meta.timestamp}/video.webm`;


  const videoRef =
    storageRef(storage, storagePath);

  await uploadBytes(videoRef, video);

  const url =
    await getDownloadURL(videoRef);


  await set(
    ref(db, `plays/${params.playId}/media`),
    {
      videoUrl: url,
      storagePath,
      uploadedAt: Date.now()
    }
  );


  return NextResponse.json({

    success: true,
    url

  });

}
