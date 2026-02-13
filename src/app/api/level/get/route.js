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
        { success: false, message: "Invalid user." },
        { status: 401 }
      );
    }

    const { id, pin } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing level id." },
        { status: 400 }
      );
    }

    const snapshot = await db.ref(`Level/${id}`).get();

    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, message: "Level not found." },
        { status: 404 }
      );
    }

    const level = snapshot.val();

    const storedPin = String(level.pin ?? "").trim();
    const enteredPin = String(pin ?? "").trim();

    const isOwner = level.authorUid === userUid;
    const isAdmin =
      Array.isArray(userRoles) && userRoles.includes("admin");

    const noPinSet = storedPin === "";

    if (!noPinSet) {
      const hasValidPin = storedPin === enteredPin;
      const hasAccess = hasValidPin || isOwner || isAdmin;

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, message: "Invalid PIN." },
          { status: 403 }
        );
      }
    }

    const structuredLevel = {
      id,
      author: level.author ?? null,
      authorUid: level.authorUid ?? null,
      name: level.name ?? null,
      keywords: level.keywords ?? [],
      poses: level.poses ?? {},
      description: level.description ?? null,
      question: level.question ?? null,
      options: Array.isArray(level.options) ? level.options : [],
      answers: Array.isArray(level.answers) ? level.answers : [],
      isPublished: level.isPublished ?? false,
      requiresPin: storedPin !== "",
    };

    return NextResponse.json({
      success: true,
      data: structuredLevel,
    });

  } catch (err) {
    console.error("Fetch level error:", err);

    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
