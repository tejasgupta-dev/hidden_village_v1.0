import { NextResponse } from "next/server";
import { requireSession } from "@/lib/firebase/requireSession";
import { db } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { success, user, response } = await requireSession();
    if (!success) return response;

    const userUid = user.uid;
    const userEmail = user.email;
    const userRoles = user.customClaims?.roles || user.roles || [];

    if (!userEmail) {
      return NextResponse.json(
        { success: false, message: "Invalid user" },
        { status: 401 }
      );
    }

    const { id, pin } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing game id." },
        { status: 400 }
      );
    }

    const snapshot = await db.ref(`Games/${id}`).get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Game not found." },
        { status: 404 }
      );
    }

    const game = snapshot.val();

    const storedPin = String(game.pin ?? "").trim();
    const enteredPin = String(pin ?? "").trim();

    const isOwner = game.authorUid === userUid;
    const isAdmin = Array.isArray(userRoles) && userRoles.includes("admin");

    // If no PIN is set, allow ANYONE to access
    const noPinSet = storedPin === "";
    
    if (!noPinSet) {
      // PIN exists - validate it (or allow owner/admin to bypass)
      const hasValidPin = storedPin === enteredPin;
      const hasAccess = hasValidPin || isOwner || isAdmin;

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, message: "Invalid PIN." },
          { status: 403 }
        );
      }
    }
    // If noPinSet === true, we skip all checks and allow access

    const structuredGame = {
      id,
      author: game.author ?? null,
      authorUid: game.authorUid ?? null,
      name: game.name ?? null,
      keywords: game.keywords ?? [],
      isPublished: game.isPublished ?? false,
      settings: game.settings ?? {},
      description: game.description ?? null,
      levelIds: game.levelIds ?? [],
      storyline: game.storyline ?? [],
      requiresPin: storedPin !== "",
    };

    return NextResponse.json({ success: true, data: structuredGame });

  } catch (err) {
    console.error("Fetch game error:", err);

    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}