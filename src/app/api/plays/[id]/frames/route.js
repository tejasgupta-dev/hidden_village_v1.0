import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebaseAdmin";
import { requireSession } from "@/lib/firebase/requireSession";
import { requirePlayOwner } from "@/lib/firebase/requirePlayOwner";

export const runtime = "nodejs";

/**
 * RTDB-friendly key (no spaces/dots/slashes)
 */
function sanitizeKey(s) {
  return (
    String(s ?? "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 64) || "unknown"
  );
}

async function getPlayId(context) {
  const resolvedParams = await context?.params;
  if (!resolvedParams || typeof resolvedParams !== "object") return null;

  const direct = resolvedParams.id ?? resolvedParams.playId;
  if (typeof direct === "string" && direct.length) return direct;

  const first = Object.values(resolvedParams).find(
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
  const { frames } = body;

  if (!Array.isArray(frames)) {
    return NextResponse.json(
      { success: false, message: "Expected { frames: [] }" },
      { status: 400 }
    );
  }

  const serverNow = Date.now();

  // 1) Raw frame writes (single copy)
  const updates = {};

  // 2) Per-state compact summaries (min/max/count) computed per POST
  //    We'll merge these into persistent ranges via transactions.
  //    Map: stateTypeKey -> { min, max, count }
  const perState = new Map();

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i] ?? {};

    const seqNum = Number(f.seq);
    const seqKey = Number.isFinite(seqNum) ? String(seqNum) : `${serverNow}-${i}`;

    // Strip redundant fields from client
    const { playId: _redundantPlayId, createdAt: _clientCreatedAt, ...raw } = f;

    const stateTypeKey = sanitizeKey(raw.stateType);

    // Raw sequential storage
    updates[`plays/${playId}/poseFrames/${seqKey}`] = {
      ...raw,
      // preserve numeric seq when available
      seq: Number.isFinite(seqNum) ? seqNum : raw.seq,
      createdAt: serverNow, // server write time
    };

    // Compact per-state aggregation for this batch
    if (Number.isFinite(seqNum)) {
      const cur = perState.get(stateTypeKey) ?? {
        min: seqNum,
        max: seqNum,
        count: 0,
      };
      cur.min = Math.min(cur.min, seqNum);
      cur.max = Math.max(cur.max, seqNum);
      cur.count += 1;
      perState.set(stateTypeKey, cur);
    }
  }

  // Write frames first (fast multi-location update)
  await db.ref().update(updates);

  // Merge per-state batch ranges into persistent ranges using transactions (atomic + race-safe)
  const txs = [];
  for (const [stateTypeKey, add] of perState.entries()) {
    const rangeRef = db.ref(
      `plays/${playId}/poseFrameRangesByState/${stateTypeKey}`
    );

    txs.push(
      rangeRef.transaction((cur) => {
        const curMin = cur?.minSeq;
        const curMax = cur?.maxSeq;
        const curCount = cur?.count ?? 0;

        const nextMin =
          typeof curMin === "number" ? Math.min(curMin, add.min) : add.min;
        const nextMax =
          typeof curMax === "number" ? Math.max(curMax, add.max) : add.max;

        return {
          minSeq: nextMin,
          maxSeq: nextMax,
          count: curCount + add.count,
          updatedAt: serverNow,
        };
      })
    );
  }

  if (txs.length) {
    await Promise.all(txs);
  }

  return NextResponse.json({
    success: true,
    wrote: frames.length,
    updatedStates: perState.size,
  });
}
