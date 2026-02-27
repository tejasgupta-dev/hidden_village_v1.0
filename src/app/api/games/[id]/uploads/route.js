// app/games/[id]/uploads/route.js
import { NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

// optional: tighten what can be uploaded
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function safeName(name = "file") {
  return String(name).replace(/[^\w.\-]+/g, "_");
}

export async function POST(req, context) {
  const { success, user, response } = await requireSession();
  if (!success) return response;

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Game ID required." },
        { status: 400 }
      );
    }

    // --- Load game ---
    const snap = await db.ref(`Games/${id}`).get();
    if (!snap.exists()) {
      return NextResponse.json(
        { success: false, message: "Game not found." },
        { status: 404 }
      );
    }
    const game = snap.val();

    // --- Permission logic (mirrors your PATCH/DELETE) ---
    const userIsAdmin = isAdmin(user);
    const isOwner = game.authorUid === user.uid;

    const pinRequired = typeof game.pin === "string" && game.pin.length > 0;
    const providedPin = req.headers.get("x-game-pin");

    if (!(isOwner || userIsAdmin)) {
      if (pinRequired) {
        if (!providedPin) {
          return NextResponse.json(
            { success: false, code: "PIN_REQUIRED", message: "PIN required" },
            { status: 403 }
          );
        }
        if (providedPin !== game.pin) {
          return NextResponse.json(
            { success: false, code: "INVALID_PIN", message: "Invalid PIN" },
            { status: 403 }
          );
        }
      }
      // If no PIN -> your current policy allows any authed user
    }

    // --- Parse multipart form ---
    const form = await req.formData();
    const file = form.get("file");
    const kind = form.get("kind") || "dialogue"; // optional metadata

    if (!file) {
      return NextResponse.json(
        { success: false, message: "Missing file." },
        { status: 400 }
      );
    }

    // file is a Web File in Next route handlers
    const contentType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(contentType)) {
      return NextResponse.json(
        { success: false, message: "Only image uploads are allowed." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { success: false, message: "File too large." },
        { status: 400 }
      );
    }

    const filename = `${Date.now()}_${safeName(file.name || "image")}`;
    const path = `games/${id}/uploads/${safeName(kind)}/${filename}`;

    // --- Upload to Storage using Admin bucket ---
    if (!storage) {
      throw new Error("Storage bucket not configured");
    }

    const storageFile = storage.file(path);

    await storageFile.save(Buffer.from(arrayBuffer), {
      contentType,
      resumable: false,
      metadata: {
        // optional metadata for debugging
        metadata: {
          uploadedBy: user.uid,
          gameId: id,
          kind: String(kind),
        },
      },
    });

    // Option A: return storage path only (recommended long-term)
    // return NextResponse.json({ success: true, path });

    // Option B: return a signed URL (easy to use immediately)
    const [url] = await storageFile.getSignedUrl({
      action: "read",
      expires: "2030-03-01",
    });

    return NextResponse.json({
      success: true,
      path,
      url,
    });
  } catch (err) {
    console.error("POST /games/[id]/uploads error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to upload file." },
      { status: 500 }
    );
  }
}