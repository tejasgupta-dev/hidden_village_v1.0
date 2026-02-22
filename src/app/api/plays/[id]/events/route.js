import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession } from "@/lib/firebase/requireSession";
import { requirePlayOwner } from "@/lib/firebase/requirePlayOwner";

export const runtime = "nodejs";

async function getPlayId(contextOrParams) {
  // Supports:
  // - POST(req, { params })
  // - POST(req, context) where context.params may be a promise
  const paramsMaybe = contextOrParams?.params ?? contextOrParams;

  const resolved =
    paramsMaybe && typeof paramsMaybe.then === "function"
      ? await paramsMaybe
      : paramsMaybe;

  if (!resolved || typeof resolved !== "object") return null;

  const direct = resolved.id ?? resolved.playId;
  if (typeof direct === "string" && direct.length) return direct;

  const first = Object.values(resolved).find(
    (v) => typeof v === "string" && v.length
  );
  return first ?? null;
}

export async function POST(req, context) {
  const { success, response, user } = await requireSession(req);
  if (!success) return response;

  const playId = await getPlayId(context);
  if (!playId) {
    return NextResponse.json(
      { success: false, message: "Missing play id" },
      { status: 400 }
    );
  }

  const isOwner = await requirePlayOwner(playId, user.uid);
  if (!isOwner) {
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const incoming = Array.isArray(body?.events)
    ? body.events
    : body && typeof body === "object"
    ? [body] // legacy single event
    : [];

  if (!incoming.length) {
    return NextResponse.json(
      {
        success: false,
        message: "Expected { events: [...] } or single event object",
      },
      { status: 400 }
    );
  }

  const serverNow = Date.now();

  // Multi-location update (fast) — ONLY eventData
  const updates = {};

  for (const evtRaw of incoming) {
    const evt = evtRaw && typeof evtRaw === "object" ? evtRaw : {};

    const eventPushKey = db.ref(`plays/${playId}/eventData`).push().key;
    updates[`plays/${playId}/eventData/${eventPushKey}`] = {
      ...evt,
      createdAt: serverNow,
    };
  }

  await db.ref().update(updates);

  return NextResponse.json({
    success: true,
    count: incoming.length,
  });
}