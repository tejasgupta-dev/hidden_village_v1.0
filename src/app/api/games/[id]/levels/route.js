import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

/* ===============================
   GET – Get Game Levels (Public)
   Returns all levels for a published game
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

    // Get game data
    const gameSnapshot = await db.ref(`Games/${id}`).get();

    if (!gameSnapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Game not found." },
        { status: 404 }
      );
    }

    const game = gameSnapshot.val();

    // Check if game is published
    if (!game.isPublished) {
      return NextResponse.json(
        {
          success: false,
          message: "Game is not published.",
        },
        { status: 403 }
      );
    }

    // Get level IDs from game
    const levelIds = game.levelIds || [];

    if (levelIds.length === 0) {
      return NextResponse.json({
        success: true,
        levels: [],
      });
    }

    // Fetch all levels
    const levelsPromises = levelIds.map((levelId) =>
      db.ref(`level/${levelId}`).get()
    );

    const levelsSnapshots = await Promise.all(levelsPromises);

    // Build levels array with only necessary data (no pin, no metadata)
    const levels = levelsSnapshots
      .map((snapshot, index) => {
        if (!snapshot.exists()) {
          console.log(`⚠️ Level ${levelIds[index]} not found`);
          return null;
        }

        const level = snapshot.val();

        // Return only game-play data (no pin, no author info, no timestamps)
        return {
          id: levelIds[index],
          name: level.name ?? "",
          description: level.description ?? "",
          options: level.options ?? [],
          answers: level.answers ?? [],
          keywords: level.keywords ?? "",
          poses: level.poses ?? {},
        };
      })
      .filter((level) => level !== null); // Remove null entries for missing levels

    console.log(`🎮 Returned ${levels.length} levels for game ${id}`);

    return NextResponse.json({
      success: true,
      levels,
    });
  } catch (err) {
    console.error("❌ GET /games/[id]/levels error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch game levels.",
      },
      { status: 500 }
    );
  }
}