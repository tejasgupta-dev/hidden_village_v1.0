import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession, isAdmin } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

/* ===============================
   GET – List Games
================================ */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode"); // "public" or default (manage)

    // ===============================
    // PUBLIC MODE (No auth required)
    // ===============================
    if (mode === "public") {
      const snapshot = await db.ref("GameList").get();

      if (!snapshot.exists()) {
        return NextResponse.json({
          success: true,
          games: [],
        });
      }

      const rawData = snapshot.val();

      // Filter only published games
      const games = Object.entries(rawData)
        .filter(([_, game]) => game.isPublished === true)
        .map(([id, game]) => ({
          id,
          name: game.name ?? "",
          keywords: game.keywords ?? "",
        }));

      return NextResponse.json({
        success: true,
        games,
      });
    }

    // ===============================
    // MANAGE MODE (Auth required)
    // ===============================
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

    // Show ALL games to all authenticated users
    const games = Object.entries(rawData).map(([id, game]) => ({
      id,
      name: game.name ?? "",
      keywords: game.keywords ?? "",
      isPublished: game.isPublished ?? false,
      author: game.author ?? "",
      authorUid: game.authorUid ?? "",
    }));

    console.log(`📋 Listed ${games.length} games for ${user.email}`);

    return NextResponse.json({
      success: true,
      games,
    });
  } catch (err) {
    console.error("❌ GET /games error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch games.",
      },
      { status: 500 }
    );
  }
}

/* ===============================
   POST – Create Game
================================ */
export async function POST(req) {
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

    // Validation
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

    // Create new game
    const newRef = db.ref("Games").push();
    const gameId = newRef.key;
    const timestamp = Date.now();

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

    // Update both Games and GameList
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

    console.log(`✅ Game ${gameId} created by ${user.email}`);

    // Return game without PIN
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
    console.error("❌ POST /games error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create game.",
      },
      { status: 500 }
    );
  }
}
