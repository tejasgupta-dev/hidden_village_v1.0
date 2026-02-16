import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

/**
 * GET /games/[id]
 * Fetches a game by ID. Handles different modes:
 *  - mode=play: only published games are accessible
 *  - default: returns preview or full game data based on permissions
 */
export async function GET(req, context) {
  try {
    // Extract game ID from URL
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

      // Return limited game data for playing
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

    // Require session for full access
    const { success, user, response } = await requireSession();
    if (!success) return response;

    const userIsAdmin = isAdmin(user); // Check if user is admin
    const isOwner = game.authorUid === user.uid; // Check ownership

    // Check if game has PIN
    const pinRequired =
      typeof game.pin === "string" &&
      game.pin.length > 0;

    // PIN from request headers
    const providedPin = req.headers.get("x-game-pin");

    // Owner or Admin always allowed
    if (isOwner || userIsAdmin) {
      // Exclude PIN from response
      const { pin, ...safeGame } = game;

      return NextResponse.json({
        success: true,
        preview: false,
        hasPin: pinRequired,
        game: {
          id,
          ...safeGame,
        },
      });
    }

    // Preview mode (no pin sent)
    if (!providedPin) {
      return NextResponse.json({
        success: true,
        preview: true,
        hasPin: pinRequired,
      });
    }

    // PIN required but incorrect
    if (pinRequired && providedPin !== game.pin) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_PIN",
          message: "Invalid PIN",
          hasPin: true,
        },
        { status: 403 }
      );
    }

    // Access granted via PIN
    const { pin, ...safeGame } = game;

    return NextResponse.json({
      success: true,
      preview: false,
      hasPin: pinRequired,
      game: {
        id,
        ...safeGame,
      },
    });

  } catch (err) {
    console.error("GET /games/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch game." },
      { status: 500 }
    );
  }
}


/**
 * PATCH /games/[id]
 * Updates a game by ID.
 * Permissions: owner, admin, or PIN access
 */
export async function PATCH(req, context) {

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

    const ref = db.ref(`Games/${id}`);
    const snapshot = await ref.get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Game not found." },
        { status: 404 }
      );
    }

    const existingGame = snapshot.val();

    const userIsAdmin = isAdmin(user);
    const isOwner = existingGame.authorUid === user.uid;

    const pinRequired =
      typeof existingGame.pin === "string" &&
      existingGame.pin.length > 0;

    const providedPin = req.headers.get("x-game-pin");

    let hasPermission = false;

    if (isOwner || userIsAdmin) {
      hasPermission = true;
    }
    else if (pinRequired) {

      if (!providedPin) {
        return NextResponse.json(
          {
            success: false,
            code: "PIN_REQUIRED",
            message: "PIN required",
          },
          { status: 403 }
        );
      }

      if (providedPin !== existingGame.pin) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_PIN",
            message: "Invalid PIN",
          },
          { status: 403 }
        );
      }

      hasPermission = true;
    }

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req.json();

    const updates = {};
    const timestamp = Date.now();

    if (body.name !== undefined) {
      updates[`Games/${id}/name`] = body.name;
      updates[`GameList/${id}/name`] = body.name;
    }

    if (body.description !== undefined)
      updates[`Games/${id}/description`] = body.description;

    if (body.keywords !== undefined) {
      updates[`Games/${id}/keywords`] = body.keywords;
      updates[`GameList/${id}/keywords`] = body.keywords;
    }

    if (body.levelIds !== undefined)
      updates[`Games/${id}/levelIds`] = body.levelIds;

    if (body.storyline !== undefined)
      updates[`Games/${id}/storyline`] = body.storyline;

    if (body.settings !== undefined)
      updates[`Games/${id}/settings`] = body.settings;

    if (body.pin !== undefined)
      updates[`Games/${id}/pin`] = body.pin;

    if (body.isPublished !== undefined) {
      updates[`Games/${id}/isPublished`] = body.isPublished;
      updates[`GameList/${id}/isPublished`] = body.isPublished;
    }

    updates[`Games/${id}/updatedAt`] = timestamp;

    await db.ref().update(updates);

    const updatedSnapshot = await db.ref(`Games/${id}`).get();
    const updatedGame = updatedSnapshot.val();

    const { pin, ...safeGame } = updatedGame;

    return NextResponse.json({
      success: true,
      game: {
        id,
        ...safeGame,
      },
    });

  } catch (err) {
    console.error("PATCH /games/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to update game." },
      { status: 500 }
    );
  }
}


/**
 * DELETE /games/[id]
 * Deletes a game by ID.
 * Permissions: owner, admin, or PIN access
 */
export async function DELETE(req, context) {

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

    const ref = db.ref(`Games/${id}`);
    const snapshot = await ref.get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Game not found." },
        { status: 404 }
      );
    }

    const game = snapshot.val();

    const userIsAdmin = isAdmin(user);
    const isOwner = game.authorUid === user.uid;

    const pinRequired =
      typeof game.pin === "string" &&
      game.pin.length > 0;

    const providedPin = req.headers.get("x-game-pin");

    let hasPermission = false;

    if (isOwner || userIsAdmin) {
      hasPermission = true;
    }
    else if (pinRequired) {

      if (!providedPin) {
        return NextResponse.json(
          {
            success: false,
            code: "PIN_REQUIRED",
            message: "PIN required",
          },
          { status: 403 }
        );
      }

      if (providedPin !== game.pin) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_PIN",
            message: "Invalid PIN",
          },
          { status: 403 }
        );
      }

      hasPermission = true;
    }

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
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
