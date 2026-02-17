import { NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase/firebaseAdmin";
import { requireSession } from "@/lib/firebase/requireSession";
import { requirePlayOwner } from "@/lib/firebase/requirePlayOwner";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const { success, response, user } = await requireSession(req);
  if (!success) return response;

  const playId = params?.id;
  if (!playId) {
    return NextResponse.json(
      { success: false, message: "Missing play id" },
      { status: 400 }
    );
  }

  const uid = user.uid;

  const isOwner = await requirePlayOwner(playId, uid);
  if (!isOwner) {
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 }
    );
  }

  const form = await req.formData();
  const video = form.get("video");

  if (!video) {
    return NextResponse.json(
      { success: false, message: "Missing video" },
      { status: 400 }
    );
  }

  // Load play metadata (Admin DB)
  const metaSnap = await db.ref(`plays/${playId}/metadata`).once("value");
  if (!metaSnap.exists()) {
    return NextResponse.json(
      { success: false, message: "Play metadata not found" },
      { status: 404 }
    );
  }

  const meta = metaSnap.val();
  const storagePath =
    `plays/${meta.gameId}/${meta.levelId}/${meta.ownerUid}/${meta.deviceId}/${meta.timestamp}/video.webm`;

  // Convert web File to Buffer
  const arrayBuffer = await video.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Cloud Storage (Admin bucket)
  const file = storage.file(storagePath);
  await file.save(buffer, {
    contentType: video.type || "video/webm",
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  // Signed URL (or public URL if you prefer)
  // If your bucket is not public, signed URLs are safer:
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
  });

  await db.ref(`plays/${playId}/media`).set({
    videoUrl: url,
    storagePath,
    uploadedAt: Date.now(),
  });

  return NextResponse.json({ success: true, url });
}
