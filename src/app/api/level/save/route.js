import { NextResponse } from "next/server";
import { requireSession } from "@/lib/firebase/requireSession";
import { db } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    // 🔐 Validate session
    const { success, user, response } = await requireSession(req);
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

    // 🧾 Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const {
      id,
      pin,
      name,
      keywords,
      poses,
      description,
      question,
      options,
      answers,
      isPublished,
    } = body;

    const safeOptions = Array.isArray(options) ? options : [];
    const safeAnswers = Array.isArray(answers) ? answers : [];

    const isAdmin =
      Array.isArray(userRoles) && userRoles.includes("admin");

    /* ============================================================
       CREATE NEW LEVEL
    ============================================================ */

    if (!id) {
      const newRef = db.ref("Level").push();
      const levelId = newRef.key;

      if (!levelId) {
        throw new Error("Failed generating level ID");
      }

      const updates = {
        [`LevelList/${levelId}`]: {
          author: userEmail,
          authorUid: userUid,
          name: name ?? null,
          keywords: keywords ?? null,
          isPublished: isPublished ?? false,
        },

        [`Level/${levelId}`]: {
          author: userEmail,
          authorUid: userUid,
          name: name ?? null,
          keywords: keywords ?? null,
          poses: poses ?? {},
          description: description ?? null,
          question: question ?? null,
          options: safeOptions,
          answers: safeAnswers,
          isPublished: isPublished ?? false,
          pin: typeof pin === "string" ? pin.trim() : "",
        },
      };

      console.log("Creating level:", levelId);

      await db.ref().update(updates);

      return NextResponse.json({
        success: true,
        data: { levelId },
      });
    }

    /* ============================================================
       UPDATE EXISTING LEVEL
    ============================================================ */

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
    const noPinSet = storedPin === "";

    // 🔐 PIN validation
    if (!noPinSet) {
      const hasValidPin = storedPin === enteredPin;

      // Only block if:
      // - Not correct pin
      // - Not owner
      // - Not admin
      if (!hasValidPin && !isOwner && !isAdmin) {
        return NextResponse.json(
          { success: false, message: "Invalid PIN." },
          { status: 403 }
        );
      }
    }

    // 📢 Validate publish requirements
    if (
      isPublished &&
      (!name ||
        !poses ||
        !question ||
        safeOptions.length === 0 ||
        safeAnswers.length === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields for published level.",
        },
        { status: 400 }
      );
    }

    // 🔁 Allow owner/admin to change pin
    let newPin = storedPin;

    if ((isOwner || isAdmin) && typeof pin === "string") {
      newPin = pin.trim();
    }

    const updates = {
      [`LevelList/${id}`]: {
        author: level.author ?? userEmail,
        authorUid: level.authorUid ?? userUid,
        name: name ?? null,
        keywords: keywords ?? null,
        isPublished: isPublished ?? false,
      },

      [`Level/${id}`]: {
        author: level.author ?? userEmail,
        authorUid: level.authorUid ?? userUid,
        name: name ?? null,
        keywords: keywords ?? null,
        poses: poses ?? {},
        description: description ?? null,
        question: question ?? null,
        options: safeOptions,
        answers: safeAnswers,
        isPublished: isPublished ?? false,
        pin: newPin,
      },
    };

    console.log("Updating level:", id);

    await db.ref().update(updates);

    return NextResponse.json({
      success: true,
      data: { levelId: id },
    });

  } catch (err) {
    console.error("Write level error:", err);

    return NextResponse.json(
      {
        success: false,
        message: "Server error.",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
