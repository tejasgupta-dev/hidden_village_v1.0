// app/games/[id]/sprites/route.js
import { NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

/** small helpers */
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function extFromFilename(name) {
  const i = String(name || "").lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function safeBaseName(name) {
  // keep it URL/filename safe
  return String(name || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 80);
}

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

  if (isOwner || userIsAdmin) return { ok: true, game };

  // if PIN exists, enforce it
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

  // no PIN => any authed user has write access (matching your PATCH/DELETE policy)
  return { ok: true, game };
}

/**
 * GET /games/[id]/sprites
 * Lists sprite metadata stored under Games/{id}/sprites
 */
export async function GET(req, context) {
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

    // Require same access as write so random authed users can't browse private assets when a PIN exists.
    const access = await assertGameWriteAccess({ gameId: id, req, user });
    if (!access.ok) return access.res;

    const snap = await db.ref(`Games/${id}/sprites`).get();
    const spritesObj = snap.exists() ? snap.val() : {};

    const sprites = Object.entries(spritesObj).map(([spriteId, v]) => ({
      spriteId,
      ...(v || {}),
    }));

    // newest first
    sprites.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, sprites });
  } catch (err) {
    console.error("GET /games/[id]/sprites error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to list sprites." },
      { status: 500 }
    );
  }
}

/**
 * POST /games/[id]/sprites
 * multipart/form-data:
 *  - file: image file (required)
 *  - name: display name (optional)
 *  - type: "speaker" | "background" | "other" (optional)
 */
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

    const access = await assertGameWriteAccess({ gameId: id, req, user });
    if (!access.ok) return access.res;

    if (!storage) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Storage bucket is not configured on the server (FIREBASE_STORAGE_BUCKET missing).",
        },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const name = form.get("name");
    const type = form.get("type");

    if (!file) {
      return NextResponse.json(
        { success: false, message: "Missing file." },
        { status: 400 }
      );
    }

    // In Next, this is usually a Web File object
    if (typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { success: false, message: "Invalid file." },
        { status: 400 }
      );
    }

    const mime = file.type || "";
    if (!mime.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "Only image uploads are allowed." },
        { status: 400 }
      );
    }

    const allowedTypes = new Set(["speaker", "background", "other"]);
    const spriteType = allowedTypes.has(String(type)) ? String(type) : "other";

    const originalName = file.name || "sprite";
    const ext = extFromFilename(originalName) || (mime.split("/")[1] || "png");

    const ts = Date.now();
    const spriteId = db.ref().push().key; // generate id
    if (!spriteId) {
      return NextResponse.json(
        { success: false, message: "Failed to generate sprite ID." },
        { status: 500 }
      );
    }

    const base = safeBaseName(
      isNonEmptyString(name)
        ? String(name).trim()
        : originalName.replace(/\.[^.]+$/, "")
    );

    const storagePath = `games/${id}/sprites/${spriteType}/${spriteId}-${base}.${ext}`;

    const buf = Buffer.from(await file.arrayBuffer());

    // upload to Firebase Storage (GCS)
    const gcsFile = storage.file(storagePath);
    await gcsFile.save(buf, {
      metadata: {
        contentType: mime,
        cacheControl: "public, max-age=31536000",
      },
      resumable: false,
    });

    // Signed URL so bucket does not need to be public
    const [signedUrl] = await gcsFile.getSignedUrl({
      action: "read",
      expires: "2100-01-01",
    });

    // store metadata in RTDB
    const createdAt = ts;
    const meta = {
      name: isNonEmptyString(name) ? String(name).trim() : base,
      type: spriteType,
      path: storagePath,
      url: signedUrl,
      contentType: mime,
      size: buf.length,
      createdAt,
      createdBy: user.uid,
    };

    await db.ref(`Games/${id}/sprites/${spriteId}`).set(meta);
    await db.ref(`Games/${id}/updatedAt`).set(createdAt);

    return NextResponse.json({
      success: true,
      sprite: { spriteId, ...meta },
    });
  } catch (err) {
    console.error("POST /games/[id]/sprites error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to upload sprite." },
      { status: 500 }
    );
  }
}