import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

export async function GET(req, context) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Game ID required." },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");

    const snapshot = await db.ref(`Games/${id}`).get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Game not found." },
        { status: 404 }
      );
    }

    const game = snapshot.val();

    if (mode === "play") {
      if (!game.isPublished) {
        return NextResponse.json(
          { success: false, message: "Game is not published." },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        game: {
          id,
          name: game.name ?? "",
          description: game.description ?? "",
          keywords: game.keywords ?? "",
          levelIds: game.levelIds ?? [],
          storyline: game.storyline ?? [],
          settings: game.settings ?? {},
        },
      });
    }


    const { success, user, response } = await requireSession();
    if (!success) return response;

    const userIsAdmin = isAdmin(user);
    const isOwner = game.authorUid === user.uid;
    const providedPin = req.headers.get("x-game-pin");
    const pinValid =
      game.pin && providedPin && providedPin === game.pin;

    if (!isOwner && !userIsAdmin && !pinValid) {
      return NextResponse.json(
        {
          success: false,
          message: "You don't have permission to access this game.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      game: {
        id,
        ...game,
      },
    });
  } catch (err) {
    console.error("❌ GET /games/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch game." },
      { status: 500 }
    );
  }
}


export async function PATCH(req, context) {
  const { success, user, response } = await requireSession();
  if (!success) return response;

  try {
    const { id } = context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Game ID required." },
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

    const existingGame = snapshot.val();

    const userIsAdmin = isAdmin(user);
    const isOwner = existingGame.authorUid === user.uid;
    const providedPin = req.headers.get("x-game-pin");
    const pinValid =
      existingGame.pin &&
      providedPin &&
      providedPin === existingGame.pin;

    if (!isOwner && !userIsAdmin && !pinValid) {
      return NextResponse.json(
        {
          success: false,
          message: "You don't have permission to update this game.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      description,
      keywords,
      levelIds,
      storyline,
      settings,
      pin,
      isPublished,
    } = body;

    const updates = {};
    const timestamp = Date.now();

    if (name !== undefined) {
      updates[`Games/${id}/name`] = name;
      updates[`GameList/${id}/name`] = name;
    }

    if (description !== undefined)
      updates[`Games/${id}/description`] = description;

    if (keywords !== undefined) {
      updates[`Games/${id}/keywords`] = keywords;
      updates[`GameList/${id}/keywords`] = keywords;
    }

    if (levelIds !== undefined)
      updates[`Games/${id}/levelIds`] = levelIds;

    if (storyline !== undefined)
      updates[`Games/${id}/storyline`] = storyline;

    if (settings !== undefined)
      updates[`Games/${id}/settings`] = settings;

    if (pin !== undefined)
      updates[`Games/${id}/pin`] = pin;

    if (isPublished !== undefined) {
      updates[`Games/${id}/isPublished`] = isPublished;
      updates[`GameList/${id}/isPublished`] = isPublished;
    }

    updates[`Games/${id}/updatedAt`] = timestamp;

    await db.ref().update(updates);

    const updatedSnapshot = await db.ref(`Games/${id}`).get();

    return NextResponse.json({
      success: true,
      game: {
        id,
        ...updatedSnapshot.val(),
      },
    });
  } catch (err) {
    console.error("❌ PATCH /games/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to update game." },
      { status: 500 }
    );
  }
}


export async function DELETE(req, context) {
  const { success, user, response } = await requireSession();
  if (!success) return response;

  try {
    const { id } = context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Game ID required." },
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

    const userIsAdmin = isAdmin(user);
    const isOwner = game.authorUid === user.uid;
    const providedPin = req.headers.get("x-game-pin");
    const pinValid =
      game.pin && providedPin && providedPin === game.pin;

    if (!isOwner && !userIsAdmin && !pinValid) {
      return NextResponse.json(
        {
          success: false,
          message: "You don't have permission to delete this game.",
        },
        { status: 403 }
      );
    }

    await db.ref().update({
      [`Games/${id}`]: null,
      [`GameList/${id}`]: null,
    });

    return NextResponse.json({
      success: true,
      message: "Game deleted successfully.",
    });
  } catch (err) {
    console.error("❌ DELETE /games/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to delete game." },
      { status: 500 }
    );
  }
}
