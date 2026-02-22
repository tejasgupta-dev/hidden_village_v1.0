// api/plays/[id]/frames
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

function levelKey(levelIndex) {
  const n = Number(levelIndex);
  return Number.isFinite(n) ? `l${Math.max(0, Math.trunc(n))}` : "l_unknown";
}

function repKey(repIndex) {
  const n = Number(repIndex);
  return Number.isFinite(n) ? `r${Math.max(0, Math.trunc(n))}` : "r0";
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

  // 1) Raw frame writes (POSE only)
  const updates = {};

  // 2) Aggregations for this POST: per (lKey, rKey, stateTypeKey)
  // key: `${lKey}|${rKey}|${stateTypeKey}` -> { min, max, count, lKey, rKey, stateTypeKey }
  const perLRS = new Map();

  let wrote = 0;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i] ?? {};

    // ✅ Only process actual POSE frames
    if (f.frameType !== "POSE") continue;

    const seqNum = Number(f.seq);
    if (!Number.isFinite(seqNum)) continue; // require numeric seq for clean ranges

    const seqKey = String(seqNum);

    // Strip redundant fields from client
    const { playId: _redundantPlayId, createdAt: _clientCreatedAt, ...raw } = f;

    const stateTypeKey = sanitizeKey(raw.stateType);
    const lKey = levelKey(raw.levelIndex);
    const rKey = repKey(raw.repIndex);

    // Raw sequential storage
    updates[`plays/${playId}/poseFrames/${seqKey}`] = {
      ...raw,
      seq: seqNum,
      createdAt: serverNow, // server write time
    };
    wrote++;

    // per (level, rep, stateType) range summary
    const key = `${lKey}|${rKey}|${stateTypeKey}`;
    const cur =
      perLRS.get(key) ?? { min: seqNum, max: seqNum, count: 0, lKey, rKey, stateTypeKey };

    cur.min = Math.min(cur.min, seqNum);
    cur.max = Math.max(cur.max, seqNum);
    cur.count += 1;

    perLRS.set(key, cur);
  }

  // Write frames first
  if (wrote > 0) {
    await db.ref().update(updates);
  }

  // Merge poseFrameRangesByState (no "byLevel/byRep/byState" words)
  // plays/{playId}/poseFrameRangesByState/{lKey}/{rKey}/{stateTypeKey}
  const txs = [];
  for (const add of perLRS.values()) {
    const rangeRef = db.ref(
      `plays/${playId}/poseFrameRangesByState/${add.lKey}/${add.rKey}/${add.stateTypeKey}`
    );

    txs.push(
      rangeRef.transaction((cur) => {
        const curMin = cur?.minSeq;
        const curMax = cur?.maxSeq;
        const curCount = cur?.count ?? 0;

        const nextMin = typeof curMin === "number" ? Math.min(curMin, add.min) : add.min;
        const nextMax = typeof curMax === "number" ? Math.max(curMax, add.max) : add.max;

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
    wrote,
    updatedRanges: perLRS.size,
  });
}