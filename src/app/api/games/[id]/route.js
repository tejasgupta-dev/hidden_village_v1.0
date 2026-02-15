import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

/* ===============================
   GET – Get Game (Public for play, Protected for edit)
================================ */
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
    const mode = url.searchParams.get("mode"); // "play" or "edit"

    const snapshot = await db.ref(`Games/${id}`).get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Game not found." },
        { status: 404 }
      );
    }

    const game = snapshot.val();

    // ===============================
    // PLAY MODE (Public)
    // ===============================
    if (mode === "play") {
      // Check if published
      if (!game.isPublished) {
        return NextResponse.json(
          {
            success: false,
            message: "Game is not published.",
          },
          { status: 403 }
        );
      }

      // Return public data (no PIN, no author info, no metadata)
      const publicGame = {
        id,
        name: game.name ?? "",
        description: game.description ?? "",
        keywords: game.keywords ?? "",
        levelIds: game.levelIds ?? [],
        storyline: game.storyline ?? [],
        settings: game.settings ?? {},
      };

      return NextResponse.json({
        success: true,
        game: publicGame,
      });
    }

    // ===============================
    // EDIT MODE (Protected)
    // ===============================
    const { success, user, response } = await requireSession();
    if (!success) return response;

    const userIsAdmin = isAdmin(user);
    const isOwner = game.authorUid === user.uid;

    // Check if PIN is required
    const pinRequired = game.pin && game.pin.length > 0;

    if (pinRequired && !userIsAdmin && !isOwner) {
      // Get pin from header or query
      const headerPin = req.headers.get("x-game-pin");
      const queryPin = url.searchParams.get("pin");
      const providedPin = headerPin || queryPin;

      if (!providedPin) {
        console.log(`🔒 PIN required for game ${id}, none provided`);
        return NextResponse.json(
          {
            success: false,
            code: "PIN_REQUIRED",
            message: "PIN required to access this game.",
          },
          { status: 403 }
        );
      }

      if (providedPin !== game.pin) {
        console.log(`❌ Invalid PIN attempt for game ${id}`);
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_PIN",
            message: "Invalid PIN provided.",
          },
          { status: 403 }
        );
      }

      console.log(`✅ Valid PIN provided for game ${id}`);
    } else if (userIsAdmin) {
      console.log(`👑 Admin ${user.email} bypassed PIN for game ${id}`);
    } else if (isOwner) {
      console.log(`👤 Owner ${user.email} accessing game ${id}`);
    }

    // Return full game data for editing (without PIN)
    const { pin, ...safeGame } = game;

    return NextResponse.json({
      success: true,
      game: {
        id,
        ...safeGame,
      },
    });
  } catch (err) {
    console.error("❌ GET /games/[id] error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch game.",
      },
      { status: 500 }
    );
  }
}

/* ===============================
   PATCH – Update Game
================================ */
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

    // Check if user is owner or admin
    if (!isOwner && !userIsAdmin) {
      console.log(
        `🚫 User ${user.email} attempted to update game ${id} without permission`
      );
      return NextResponse.json(
        {
          success: false,
          message: "You don't have permission to update this game.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Fields that can be updated
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

    // Validate fields
    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return NextResponse.json(
        { success: false, message: "Valid name required." },
        { status: 400 }
      );
    }

    if (levelIds !== undefined && !Array.isArray(levelIds)) {
      return NextResponse.json(
        { success: false, message: "levelIds must be an array." },
        { status: 400 }
      );
    }

    if (storyline !== undefined && !Array.isArray(storyline)) {
      return NextResponse.json(
        { success: false, message: "storyline must be an array." },
        { status: 400 }
      );
    }

    if (
      settings !== undefined &&
      (typeof settings !== "object" || settings === null || Array.isArray(settings))
    ) {
      return NextResponse.json(
        { success: false, message: "settings must be an object." },
        { status: 400 }
      );
    }

    // Build update object
    const updates = {};
    const timestamp = Date.now();

    if (name !== undefined) {
      updates[`Games/${id}/name`] = name;
      updates[`GameList/${id}/name`] = name;
    }

    if (description !== undefined) {
      updates[`Games/${id}/description`] = description;
    }

    if (keywords !== undefined) {
      updates[`Games/${id}/keywords`] = keywords;
      updates[`GameList/${id}/keywords`] = keywords;
    }

    if (levelIds !== undefined) {
      updates[`Games/${id}/levelIds`] = levelIds;
    }

    if (storyline !== undefined) {
      updates[`Games/${id}/storyline`] = storyline;
    }

    if (settings !== undefined) {
      updates[`Games/${id}/settings`] = settings;
    }

    if (pin !== undefined) {
      updates[`Games/${id}/pin`] = pin;
    }

    if (isPublished !== undefined) {
      updates[`Games/${id}/isPublished`] = isPublished;
      updates[`GameList/${id}/isPublished`] = isPublished;
    }

    updates[`Games/${id}/updatedAt`] = timestamp;

    await db.ref().update(updates);

    console.log(`✅ Game ${id} updated by ${user.email}`);

    // Get updated game
    const updatedSnapshot = await db.ref(`Games/${id}`).get();
    const updatedGame = updatedSnapshot.val();
    const { pin: _, ...safeGame } = updatedGame;

    return NextResponse.json({
      success: true,
      game: {
        id,
        ...safeGame,
      },
    });
  } catch (err) {
    console.error("❌ PATCH /games/[id] error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update game.",
      },
      { status: 500 }
    );
  }
}

/* ===============================
   DELETE – Delete Game
================================ */
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

    // Check if user is owner or admin
    if (!isOwner && !userIsAdmin) {
      console.log(
        `🚫 User ${user.email} attempted to delete game ${id} without permission`
      );
      return NextResponse.json(
        {
          success: false,
          message: "You don't have permission to delete this game.",
        },
        { status: 403 }
      );
    }

    // Delete from both Games and GameList
    await db.ref().update({
      [`Games/${id}`]: null,
      [`GameList/${id}`]: null,
    });

    console.log(`🗑️ Game ${id} deleted by ${user.email}`);

    return NextResponse.json({
      success: true,
      message: "Game deleted successfully.",
    });
  } catch (err) {
    console.error("❌ DELETE /games/[id] error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete game.",
      },
      { status: 500 }
    );
  }
}


/*

// 1. Play game (public)
fetch('/api/games/game123?mode=play')
// Returns: { success: true, game: { id, name, description, levelIds, ... } }

// 2. Edit game (requires auth)
fetch('/api/games/game123', {
  credentials: 'include'
})
// Returns: { success: true, game: { ...fullGameData } }

// 3. Edit with PIN
fetch('/api/games/game123?pin=1234', {
  credentials: 'include'
})

// 4. Update game
fetch('/api/games/game123', {
  method: 'PATCH',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'New Name', isPublished: true })
})

// 5. Delete game
fetch('/api/games/game123', {
  method: 'DELETE',
  credentials: 'include'
})

*/