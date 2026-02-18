import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession } from "@/lib/firebase/requireSession";
import { requirePlayOwner } from "@/lib/firebase/requirePlayOwner";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const { success, response, user } = await requireSession(req);
  if (!success) return response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { success: false, message: "Missing play id" },
      { status: 400 }
    );
  }

  const isOwner = await requirePlayOwner(id, user.uid);
  if (!isOwner) {
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));

  // ✅ Accept batch shape: { events: [...] }
  const events = Array.isArray(body.events) ? body.events : null;

  if (events) {
    const baseRef = db.ref(`plays/${id}/eventData`);
    const updates = {};

    for (const evt of events) {
      const key = baseRef.push().key;
      updates[`plays/${id}/eventData/${key}`] = {
        ...evt,
        createdAt: Date.now(),
      };
    }

    await db.ref().update(updates);

    return NextResponse.json({ success: true, count: events.length });
  }

  // ✅ Or accept single event object (legacy)
  const eventRef = db.ref(`plays/${id}/eventData`).push();
  await eventRef.set({
    ...body,
    createdAt: Date.now(),
  });

  return NextResponse.json({ success: true, count: 1 });
}
