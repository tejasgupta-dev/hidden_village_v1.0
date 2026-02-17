import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession } from "@/lib/firebase/requireSession";

export const runtime = "nodejs";

// GET handler — fetches all levels from the Realtime Database (LevelList)
export async function GET(req) {
  try {
    const snapshot = await db.ref("LevelList").get();

    if (!snapshot.exists()) {
      return NextResponse.json({ success: true, levels: [] });
    }

    const data = snapshot.val();

    const levels = Object.entries(data).map(([id, level]) => {
      const published =
        level?.isPublished === true || level?.isPublished === "true";

      return {
        id,
        name: level?.name || "",
        author: level?.author || "anonymous",
        authorUid: level?.authorUid || "",
        isPublished: published,
        keywords: level?.keywords || "",
      };
    });

    return NextResponse.json({ success: true, levels });
  } catch (err) {
    console.error("GET /levels error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch levels." },
      { status: 500 }
    );
  }
}

// POST handler — creates a new level
export async function POST(req) {
  const { success, user, response } = await requireSession(req);
  if (!success) return response;

  try {
    const body = await req.json();

    const {
      name,
      description = "",
      options = [],
      answers = [],
      keywords = "",
      pin = "",
      isPublished = false,
      poses = {},
    } = body;

    // Validation
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, message: "Valid name required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(options)) {
      return NextResponse.json(
        { success: false, message: "Options must be an array." },
        { status: 400 }
      );
    }

    if (!Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, message: "Answers must be an array." },
        { status: 400 }
      );
    }

    if (typeof poses !== "object" || poses === null) {
      return NextResponse.json(
        { success: false, message: "Poses must be an object." },
        { status: 400 }
      );
    }

    // Normalize publish boolean
    const published = isPublished === true || isPublished === "true";

    const levelRef = db.ref("level").push();
    const levelId = levelRef.key;

    const level = {
      name,
      description,
      options,
      answers,
      keywords,
      pin,
      isPublished: published,
      poses,
      author: user.email || "anonymous",
      authorUid: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const levelListEntry = {
      name,
      author: user.email || "anonymous",
      authorUid: user.uid,
      isPublished: published,
      keywords,
    };

    await db.ref(`level/${levelId}`).set(level);
    await db.ref(`LevelList/${levelId}`).set(levelListEntry);

    return NextResponse.json({
      success: true,
      id: levelId,
      level,
    });
  } catch (err) {
    console.error("POST /levels error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to create level.", error: err.message },
      { status: 500 }
    );
  }
}
