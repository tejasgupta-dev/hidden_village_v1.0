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

    const snapshot = await db.ref("LevelList").get();

    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        data: {},
        message: "No levels found (empty DB)",
      });
    }

    const rawData = snapshot.val();

    const structuredData = Object.fromEntries(
      Object.entries(rawData).map(([levelId, level]) => {
        const isOwner = level?.authorUid === userUid;
        const isAdmin =
          Array.isArray(userRoles) && userRoles.includes("admin");

        return [
          levelId,
          {
            author: level?.author ?? null,
            authorUid: level?.authorUid ?? null,
            name: level?.name ?? null,
            keywords: level?.keywords ?? [],
            isPublished: level?.isPublished ?? false,
            canEdit: isOwner || isAdmin,
          },
        ];
      })
    );

    return NextResponse.json({
      success: true,
      data: structuredData,
    });

  } catch (error) {
    console.error("Level list error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch levels.",
      },
      { status: 500 }
    );
  }
}
