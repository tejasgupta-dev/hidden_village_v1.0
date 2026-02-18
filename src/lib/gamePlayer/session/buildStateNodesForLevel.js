"use client";

import { STATE_TYPES } from "@/lib/gamePlayer/states/_shared/stateTypes";

/**
 * Build stateNodes from:
 * - game.storyline[levelIndex] -> intro/outro dialogues (per level)
 * - level (game.levels[levelIndex]) -> poses map (object)
 *
 * We do NOT store stateNodes in Firebase.
 */

function unwrapDoc(maybeDoc) {
  if (!maybeDoc) return { id: null, data: null };

  // Firestore DocumentSnapshot: { id, data(): {...} }
  if (typeof maybeDoc?.data === "function") {
    return { id: maybeDoc?.id ?? null, data: maybeDoc.data() ?? null };
  }

  // Some shapes: { id, data: {...} }
  if (
    maybeDoc?.data &&
    typeof maybeDoc.data === "object" &&
    !Array.isArray(maybeDoc.data)
  ) {
    return { id: maybeDoc?.id ?? null, data: maybeDoc.data };
  }

  // Plain object
  return { id: maybeDoc?.id ?? null, data: maybeDoc };
}

function normalizeDialogueLines(raw) {
  // Accept:
  // - [{speaker, text}, ...]
  // - ["hi", "there"]
  // - { lines: [...] }
  if (!raw) return [];
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.lines)
    ? raw.lines
    : Array.isArray(raw?.dialogues)
    ? raw.dialogues
    : [];

  return arr
    .map((x) => {
      if (typeof x === "string") return { text: x };
      if (x && typeof x === "object") return { speaker: x.speaker, text: x.text ?? "" };
      return null;
    })
    .filter(Boolean)
    .filter((x) => String(x.text ?? "").trim().length > 0);
}

function resolveCursorDelayMS({ storyLevel, level }, nodeType) {
  // prefer more specific > generic > settings
  if (nodeType === STATE_TYPES.INTRO) {
    return (
      storyLevel?.introCursorDelayMS ??
      storyLevel?.cursorDelayMS ??
      level?.introCursorDelayMS ??
      level?.cursorDelayMS ??
      level?.settings?.cursor?.delayMS ??
      undefined
    );
  }

  if (nodeType === STATE_TYPES.OUTRO) {
    return (
      storyLevel?.outroCursorDelayMS ??
      storyLevel?.cursorDelayMS ??
      level?.outroCursorDelayMS ??
      level?.cursorDelayMS ??
      level?.settings?.cursor?.delayMS ??
      undefined
    );
  }

  // pose/tween
  return (
    storyLevel?.poseCursorDelayMS ??
    storyLevel?.cursorDelayMS ??
    level?.poseCursorDelayMS ??
    level?.cursorDelayMS ??
    level?.settings?.cursor?.delayMS ??
    undefined
  );
}

function resolveAutoAdvanceMS({ storyLevel, level }, nodeType) {
  // Optional per-line autoplay for dialogue-like nodes (Option A reducer auto-next)
  if (nodeType === STATE_TYPES.INTRO) {
    return (
      storyLevel?.introAutoAdvanceMS ??
      storyLevel?.autoAdvanceMS ??
      level?.introAutoAdvanceMS ??
      level?.autoAdvanceMS ??
      undefined
    );
  }
  if (nodeType === STATE_TYPES.OUTRO) {
    return (
      storyLevel?.outroAutoAdvanceMS ??
      storyLevel?.autoAdvanceMS ??
      level?.outroAutoAdvanceMS ??
      level?.autoAdvanceMS ??
      undefined
    );
  }
  return (
    storyLevel?.autoAdvanceMS ??
    level?.autoAdvanceMS ??
    undefined
  );
}

function getPoseIds(level) {
  // DB format you showed: poses is an object map
  // poses: { pose_1771...: "<json string>", ... }
  const poses = level?.poses;

  if (!poses) return [];

  // If it ever becomes an array later, support that too
  if (Array.isArray(poses)) {
    return poses
      .map((p) => p?.id ?? p?.poseId ?? p?.key ?? null)
      .filter(Boolean);
  }

  if (typeof poses === "object") {
    return Object.keys(poses).filter(Boolean);
  }

  return [];
}

export function buildStateNodesForLevel({
  level: levelInput,
  story: gameInput,
  levelIndex = 0,
}) {
  const { id: levelDocId, data: level } = unwrapDoc(levelInput);
  const { id: gameDocId, data: game } = unwrapDoc(gameInput);

  const nodes = [];

  // Get per-level story entry: game.storyline[levelIndex]
  const storyLevel =
    Array.isArray(game?.storyline) ? game.storyline[levelIndex] ?? null : null;

  // 1) INTRO (from game.storyline[levelIndex].intro)
  const introLines = normalizeDialogueLines(storyLevel?.intro);

  if (introLines.length > 0) {
    nodes.push({
      type: STATE_TYPES.INTRO,
      lines: introLines,
      cursorDelayMS: resolveCursorDelayMS({ storyLevel, level }, STATE_TYPES.INTRO),
      autoAdvanceMS: resolveAutoAdvanceMS({ storyLevel, level }, STATE_TYPES.INTRO),

      // optional debug
      levelId: level?.id ?? levelDocId ?? null,
      gameId: game?.id ?? gameDocId ?? null,
    });
  }

  // 2) POSES (from level.poses map)
  const poseIds = getPoseIds(level);

  // Only add pose nodes if there are poses
  for (let i = 0; i < poseIds.length; i++) {
    const toPoseId = poseIds[i];
    const fromPoseId = i > 0 ? poseIds[i - 1] : null;

    const cursorDelayMS = resolveCursorDelayMS(
      { storyLevel, level },
      STATE_TYPES.POSE_MATCH
    );

    // Tween between poses (skip first) — only if STATE_TYPES.TWEEN exists
    if (fromPoseId && STATE_TYPES.TWEEN) {
      nodes.push({
        type: STATE_TYPES.TWEEN,
        fromPoseId,
        toPoseId,
        durationMS: level?.tweenDurationMS ?? storyLevel?.tweenDurationMS ?? 600,
        easing: level?.tweenEasing ?? storyLevel?.tweenEasing ?? "easeInOut",
        cursorDelayMS,
        levelId: level?.id ?? levelDocId ?? null,
      });
    }

    nodes.push({
      type: STATE_TYPES.POSE_MATCH,
      targetPoseId: toPoseId,
      threshold: level?.poseThreshold ?? storyLevel?.poseThreshold ?? 0.85,
      cursorDelayMS,
      durationMS: level?.poseDurationMS ?? storyLevel?.poseDurationMS ?? undefined,

      levelId: level?.id ?? levelDocId ?? null,
    });
  }

  // 3) OUTRO (from game.storyline[levelIndex].outro)
  const outroLines = normalizeDialogueLines(storyLevel?.outro);

  if (outroLines.length > 0) {
    nodes.push({
      type: STATE_TYPES.OUTRO,
      lines: outroLines,
      cursorDelayMS: resolveCursorDelayMS({ storyLevel, level }, STATE_TYPES.OUTRO),
      autoAdvanceMS: resolveAutoAdvanceMS({ storyLevel, level }, STATE_TYPES.OUTRO),

      levelId: level?.id ?? levelDocId ?? null,
      gameId: game?.id ?? gameDocId ?? null,
    });
  }

  return nodes;
}
