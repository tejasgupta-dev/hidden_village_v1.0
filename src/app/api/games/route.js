import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

/**
 * GET /games
 * 
 * Fetches a list of games.
 * - If query param ?mode=public is set, returns only published games without requiring login (for game menu)
 * - Otherwise, requires a valid user session and returns all games with general details (for edit menu)
 */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");

    // PUBLIC MODE: return only published games
    if (mode === "public") {
      const snapshot = await db.ref("GameList").get();
      if (!snapshot.exists()) {
        return NextResponse.json({
          success: true,
          games: [],
        });
      }
      const rawData = snapshot.val();

      // Filter published games and return basic info
      const games = Object.entries(rawData)
        .filter(([_, game]) => game.isPublished === true)
        .map(([id, game]) => ({
          id,
          name: game.name ?? "",
          keywords: game.keywords ?? "",
          author: game.author ?? "",
        }));

      return NextResponse.json({
        success: true,
        games,
      });
    }

    // PRIVATE MODE: requires session
    const { success, user, response } = await requireSession();
    if (!success) return response;

    const snapshot = await db.ref("GameList").get();

    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        games: [],
      });
    }

    const rawData = snapshot.val();

    // Return all games with general details for authenticated users
    const games = Object.entries(rawData).map(([id, game]) => ({
      id,
      name: game.name ?? "",
      keywords: game.keywords ?? "",
      isPublished: game.isPublished ?? false,
      author: game.author ?? "",
      authorUid: game.authorUid ?? "",
    }));

    return NextResponse.json({
      success: true,
      games,
    });
  } catch (err) {
    console.error("GET /games error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch games.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /games
 * 
 * Creates a new game in the database.
 * Requires a valid user session.
 */
export async function POST(req) {
  // Ensure the requester is authenticated
  const { success, user, response } = await requireSession();
  if (!success) return response;

  try {
    const body = await req.json();

    const {
      name,
      description = "",
      keywords = "",
      levelIds = [],
      storyline = [],
      settings = {},
      pin = "",
      isPublished = false,
    } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Valid name required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(levelIds)) {
      return NextResponse.json(
        { success: false, message: "levelIds must be an array." },
        { status: 400 }
      );
    }

    if (!Array.isArray(storyline)) {
      return NextResponse.json(
        { success: false, message: "storyline must be an array." },
        { status: 400 }
      );
    }

    if (
      typeof settings !== "object" ||
      settings === null ||
      Array.isArray(settings)
    ) {
      return NextResponse.json(
        { success: false, message: "settings must be an object." },
        { status: 400 }
      );
    }

    // Create a new database reference for the game
    const newRef = db.ref("Games").push();
    const gameId = newRef.key;
    const timestamp = Date.now();

    // Construct game data object
    const gameData = {
      name,
      description,
      keywords,
      levelIds,
      storyline,
      settings,
      pin,
      isPublished,
      author: user.email || "anonymous",
      authorUid: user.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Write to both Games (full data) and GameList (summary for listing)
    await db.ref().update({
      [`Games/${gameId}`]: gameData,
      [`GameList/${gameId}`]: {
        name: gameData.name,
        keywords: gameData.keywords,
        isPublished: gameData.isPublished,
        author: gameData.author,
        authorUid: gameData.authorUid,
      },
    });

    // Exclude PIN from the response for security
    const { pin: _, ...safeGame } = gameData;

    return NextResponse.json({
      success: true,
      id: gameId,
      game: {
        id: gameId,
        ...safeGame,
      },
    });
  } catch (err) {
    console.error("POST /games error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create game.",
      },
      { status: 500 }
    );
  }
}
