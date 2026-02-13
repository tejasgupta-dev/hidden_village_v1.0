import { NextResponse } from "next/server";
import { requireSession } from "@/lib/firebase/requireSession";
import { db } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { success, user, response } = await requireSession();
    if (!success) return response;

    const userUid = user.uid;
    const userRoles = user.customClaims?.roles || user.roles || [];

    const snapshot = await db.ref("GameList").get();

    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        data: {},
        message: "No games found (empty DB)",
      });
    }

    const rawData = snapshot.val();

    const structuredData = Object.fromEntries(
      Object.entries(rawData).map(([gameId, game]) => {
        const isOwner = game?.authorUid === userUid;

        return [
          gameId,
          {
            author: game?.author ?? null,
            authorUid: game?.authorUid ?? null,
            name: game?.name ?? null,
            keywords: game?.keywords ?? [],
            isPublished: game?.isPublished ?? false,
          },
        ];
      })
    );

    return NextResponse.json({
      success: true,
      data: structuredData,
    });

  } catch (error) {
    console.error("Game list error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch games.",
      },
      { status: 500 }
    );
  }
}
