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
        { success: false, message: "Invalid session." },
        { status: 401 }
      );
    }

    const { gameId, enteredPin } = await req.json();

    if (!gameId) {
      return NextResponse.json(
        { success: false, message: "Missing game id." },
        { status: 400 }
      );
    }

    const snapshot = await db.ref(`Games/${gameId}`).get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Game not found." },
        { status: 404 }
      );
    }

    const gameData = snapshot.val();
    const storedPin = String(gameData.pin ?? "").trim();
    const enteredPinStr = String(enteredPin ?? "").trim();

    const isOwner = gameData.authorUid === userUid;
    const isAdmin = Array.isArray(userRoles) && userRoles.includes("admin");

    // If no PIN is set, allow anyone to delete (public game)
    const noPinSet = storedPin === "";
    
    if (!noPinSet) {
      // PIN exists - validate it (or allow owner/admin to bypass)
      const hasValidPin = storedPin === enteredPinStr;
      const hasAccess = hasValidPin || isOwner || isAdmin;

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, message: "Invalid PIN or unauthorized." },
          { status: 403 }
        );
      }
    }
    // If noPinSet === true, skip authorization (anyone can delete)

    // Delete game
    await db.ref().update({
      [`GameList/${gameId}`]: null,
      [`Games/${gameId}`]: null,
    });

    return NextResponse.json({
      success: true,
      message: "Game deleted successfully.",
    });
    
  } catch (error) {
    console.error("Delete game error:", error);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}