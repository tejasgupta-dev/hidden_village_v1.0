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

    const body = await req.json();

    const {
      gameId,
      enteredPin,
      newPin,
      name,
      keywords,
      description,
      levelIds,
      storyline,
      settings,
      isPublished,
    } = body;

    // ===============================
    // CREATE
    // ===============================
    if (!gameId) {
      const newRef = db.ref("Games").push();
      const newGameId = newRef.key;

      const gameData = {
        name: name ?? "",
        keywords: keywords ?? "",
        description: description ?? "",
        levelIds: Array.isArray(levelIds) ? levelIds : [],
        storyline: Array.isArray(storyline) ? storyline : [],
        settings: settings ?? {},
        isPublished: !!isPublished,
        pin: newPin ?? "",
        author: userEmail,
        authorUid: userUid,
        createdAt: Date.now(),
      };

      await db.ref().update({
        [`Games/${newGameId}`]: gameData,
        [`GameList/${newGameId}`]: {
          name: gameData.name,
          keywords: gameData.keywords,
          isPublished: gameData.isPublished,
          author: userEmail,
        },
      });

      return NextResponse.json({
        success: true,
        gameId: newGameId,
      });
    }

    // ===============================
    // UPDATE
    // ===============================
    const snapshot = await db.ref(`Games/${gameId}`).get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Game not found." },
        { status: 404 }
      );
    }

    const game = snapshot.val();
    const isOwner = game.authorUid === userUid;
    const isAdmin = Array.isArray(userRoles) && userRoles.includes("admin");

    const storedPin = String(game.pin ?? "").trim();
    const enteredPinStr = String(enteredPin ?? "").trim();
    const noPinSet = storedPin === "";

    if (!noPinSet) {
      const hasValidPin = storedPin === enteredPinStr;
      const hasAccess = hasValidPin || isOwner || isAdmin;

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, message: "Invalid PIN or unauthorized." },
          { status: 403 }
        );
      }
    }

    const updates = {};

    if (name !== undefined) updates[`Games/${gameId}/name`] = name;
    if (keywords !== undefined) updates[`Games/${gameId}/keywords`] = keywords;
    if (description !== undefined)
      updates[`Games/${gameId}/description`] = description;
    if (Array.isArray(levelIds))
      updates[`Games/${gameId}/levelIds`] = levelIds;
    if (Array.isArray(storyline))
      updates[`Games/${gameId}/storyline`] = storyline;
    if (settings !== undefined)
      updates[`Games/${gameId}/settings`] = settings;
    if (isPublished !== undefined)
      updates[`Games/${gameId}/isPublished`] = !!isPublished;
    if (newPin !== undefined)
      updates[`Games/${gameId}/pin`] = newPin;

    if (name !== undefined)
      updates[`GameList/${gameId}/name`] = name;
    if (keywords !== undefined)
      updates[`GameList/${gameId}/keywords`] = keywords;
    if (isPublished !== undefined)
      updates[`GameList/${gameId}/isPublished`] = !!isPublished;

    await db.ref().update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save game error:", error);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
