// app/game/play/[id]/page.jsx
import { db } from "@/lib/firebase/firebaseAdmin";
import GamePlayerClient from "./playerClient";

export const dynamic = "force-dynamic";

/* ----------------------------- helpers ----------------------------- */

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function normalizeBool(v) {
  return v === true || v === "true";
}

function asObject(v) {
  return isPlainObject(v) ? v : {};
}

/**
 * Normalize speakers map to a predictable shape:
 * settings.speakers = {
 *   [speakerId]: { id, name, url?, path?, spriteId? }
 * }
 */
function normalizeSpeakers(rawSpeakers) {
  const src = asObject(rawSpeakers);
  const out = {};

  for (const [k, v] of Object.entries(src)) {
    const speakerId = String(k || "").trim();
    if (!speakerId) continue;

    const s = isPlainObject(v) ? v : {};
    out[speakerId] = {
      id: String(s.id || speakerId),
      name: typeof s.name === "string" ? s.name : speakerId,

      // NEW sprite fields (preferred)
      spriteId: typeof s.spriteId === "string" ? s.spriteId : undefined,
      url: typeof s.url === "string" ? s.url : undefined,

      // legacy field (if you still have it in old games)
      path: typeof s.path === "string" ? s.path : undefined,

      createdAt:
        typeof s.createdAt === "number" && Number.isFinite(s.createdAt)
          ? s.createdAt
          : undefined,
    };
  }

  return out;
}

/**
 * Add convenient lookup maps to settings so player can render easily:
 * - settings.speakerById
 * - settings.speakerUrlById
 */
function normalizeGameSettings(rawSettings) {
  const settings = asObject(rawSettings);

  const speakers = normalizeSpeakers(settings.speakers);

  const speakerById = {};
  const speakerUrlById = {};

  for (const [id, s] of Object.entries(speakers)) {
    speakerById[id] = s;
    if (s?.url) speakerUrlById[id] = s.url;
  }

  return {
    ...settings,
    speakers,
    speakerById,
    speakerUrlById,
  };
}

/**
 * RTDB poses may come back as:
 *  - object: { pose_123: "{\"pose\":{...},\"tolerancePct\":69}", ... }
 *  - or already-parsed object in some cases
 *
 * We normalize to:
 *  - poses: { pose_123: <poseObject>, ... }
 *  - poseTolerancePctById: { pose_123: 69, ... }
 */
function normalizePoses(rawPoses) {
  const poses = {};
  const poseTolerancePctById = {};

  if (!rawPoses) return { poses, poseTolerancePctById };

  // RTDB can return array-ish or object; treat both
  const entries = Array.isArray(rawPoses)
    ? rawPoses.map((v, i) => [`pose_${i}`, v])
    : Object.entries(rawPoses);

  for (const [poseIdRaw, raw] of entries) {
    const poseId = String(poseIdRaw || "").trim();
    if (!poseId) continue;

    let parsed = raw;

    // 1) If it's a JSON string, parse it
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
    }

    // 2) If it's { pose: {...}, tolerancePct }, extract pose + map tolerance
    if (isPlainObject(parsed) && isPlainObject(parsed.pose)) {
      poses[poseId] = parsed.pose;

      if (parsed.tolerancePct != null && parsed.tolerancePct !== "") {
        poseTolerancePctById[poseId] = clamp(parsed.tolerancePct, 0, 100);
      }
      continue;
    }

    // 3) If it's already a pose-like object, store it directly
    if (isPlainObject(parsed)) {
      poses[poseId] = parsed;
      continue;
    }
  }

  return { poses, poseTolerancePctById };
}

function toPlayableLevel(levelId, level) {
  const question = typeof level?.question === "string" ? level.question : "";

  const trueFalseEnabled = normalizeBool(level?.trueFalseEnabled);
  const trueFalseAnswer =
    typeof level?.trueFalseAnswer === "boolean"
      ? level.trueFalseAnswer
      : level?.trueFalseAnswer === "true"
      ? true
      : level?.trueFalseAnswer === "false"
      ? false
      : null;

  // options can be array OR RTDB object {0:"...",1:"..."} — keep as-is, builder normalizes
  const options = level?.options ?? [];

  // ✅ IMPORTANT: normalize RTDB pose JSON strings -> objects
  const { poses, poseTolerancePctById: tolFromPoses } = normalizePoses(
    level?.poses ?? {}
  );

  // allow explicit map on level to override / extend parsed tolerances
  const tolFromLevel =
    level?.poseTolerancePctById && typeof level.poseTolerancePctById === "object"
      ? level.poseTolerancePctById
      : {};

  const poseTolerancePctById = {
    ...tolFromPoses,
    ...tolFromLevel,
  };

  return {
    // identity
    id: levelId,
    name: level?.name ?? "",
    description: level?.description ?? "",
    keywords: level?.keywords ?? "",

    // ✅ pose content (NOW objects, not JSON strings)
    poses,

    // ✅ INSIGHT inputs
    question,
    options,

    // ✅ INTUITION inputs
    trueFalseEnabled,
    trueFalseAnswer,

    // (keep if you use these elsewhere; harmless)
    answers: level?.answers ?? [],

    // ✅ pose matching config
    poseTolerancePctById,
    poseThreshold: level?.poseThreshold ?? 60,
    poseDurationMS: level?.poseDurationMS ?? null,

    // tween config
    tweenDurationMS: level?.tweenDurationMS ?? null,
    tweenEasing: level?.tweenEasing ?? null,

    // optional per-level cursor settings passthrough
    settings: level?.settings ?? {},
    cursorDelayMS: level?.cursorDelayMS ?? null,
    introCursorDelayMS: level?.introCursorDelayMS ?? null,
    outroCursorDelayMS: level?.outroCursorDelayMS ?? null,
    poseCursorDelayMS: level?.poseCursorDelayMS ?? null,
  };
}

async function fetchGameAndLevels(gameId) {
  const gameSnapshot = await db.ref(`Games/${gameId}`).get();
  if (!gameSnapshot.exists()) throw new Error("Game not found.");

  const game = gameSnapshot.val();
  if (!game.isPublished) throw new Error("Game is not published.");

  const levelIds = game.levelIds ?? [];

  const levelSnapshots = await Promise.all(
    // NOTE: if your RTDB path is actually "Levels" not "level", change it here.
    levelIds.map((levelId) => db.ref(`level/${levelId}`).get())
  );

  const levels = levelSnapshots
    .map((snapshot, i) => {
      if (!snapshot.exists()) {
        console.log(`⚠️ Level ${levelIds[i]} not found`);
        return null;
      }
      const level = snapshot.val();
      return toPlayableLevel(levelIds[i], level);
    })
    .filter(Boolean);

  const { pin, ...safeGame } = game;

  // ✅ NEW: normalize settings so speaker URLs are easy to access in the player
  const settings = normalizeGameSettings(safeGame.settings ?? {});

  return {
    game: {
      id: gameId,
      name: safeGame.name ?? "",
      description: safeGame.description ?? "",
      keywords: safeGame.keywords ?? "",
      levelIds,
      storyline: safeGame.storyline ?? [],
      settings,
    },
    levels,
  };
}

export default async function Page({ params, searchParams }) {
  const { id: gameId } = await params;
  const { level } = await searchParams;

  const { game, levels } = await fetchGameAndLevels(gameId);
  const levelIndex = level ? Number(level) : 0;

  return (
    <GamePlayerClient
      game={game}
      levels={levels}
      levelIndex={Number.isFinite(levelIndex) ? levelIndex : 0}
    />
  );
}