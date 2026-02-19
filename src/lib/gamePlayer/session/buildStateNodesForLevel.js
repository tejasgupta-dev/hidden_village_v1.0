"use client";

import { STATE_TYPES } from "@/lib/gamePlayer/states/_shared/stateTypes";

/**
 * Build stateNodes from:
 * - game.storyline[levelIndex] -> intro/outro dialogues (per level)
 * - level (game.levels[levelIndex]) -> poses map (object)
 *
 * We do NOT store stateNodes in Firebase.
 *
 * ✅ Behavior:
 * - ONE TWEEN node for all poses (poseIds[])
 * - ONE POSE_MATCH node for all poses (poseIds[])
 */

function unwrapDoc(maybeDoc) {
  if (!maybeDoc) return { id: null, data: null };

  if (typeof maybeDoc?.data === "function") {
    return { id: maybeDoc?.id ?? null, data: maybeDoc.data() ?? null };
  }

  if (
    maybeDoc?.data &&
    typeof maybeDoc.data === "object" &&
    !Array.isArray(maybeDoc.data)
  ) {
    return { id: maybeDoc?.id ?? null, data: maybeDoc.data };
  }

  return { id: maybeDoc?.id ?? null, data: maybeDoc };
}

function normalizeDialogueLines(raw) {
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

function getPoseIds(level) {
  const poses = level?.poses;
  if (!poses) return [];

  // If it ever becomes an array later, support that too
  if (Array.isArray(poses)) {
    return poses
      .map((p) => p?.id ?? p?.poseId ?? p?.key ?? null)
      .filter(Boolean);
  }

  if (typeof poses === "object") {
    // stable ordering: sort by numeric suffix in "pose_<timestamp>"
    return Object.keys(poses)
      .filter(Boolean)
      .sort((a, b) => {
        const ta = Number(String(a).split("_")[1] ?? 0);
        const tb = Number(String(b).split("_")[1] ?? 0);
        return ta - tb;
      });
  }

  return [];
}

function resolveCursorDelayMS({ storyLevel, level }, nodeType) {
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

  return storyLevel?.autoAdvanceMS ?? level?.autoAdvanceMS ?? undefined;
}

export function buildStateNodesForLevel({
  level: levelInput,
  story: gameInput,
  levelIndex = 0,
}) {
  const { id: levelDocId, data: level } = unwrapDoc(levelInput);
  const { id: gameDocId, data: game } = unwrapDoc(gameInput);

  const nodes = [];

  const storyLevel =
    Array.isArray(game?.storyline) ? game.storyline[levelIndex] ?? null : null;

  // 1) INTRO
  const introLines = normalizeDialogueLines(storyLevel?.intro);
  if (introLines.length > 0) {
    nodes.push({
      type: STATE_TYPES.INTRO,
      lines: introLines,
      cursorDelayMS: resolveCursorDelayMS({ storyLevel, level }, STATE_TYPES.INTRO),
      autoAdvanceMS: resolveAutoAdvanceMS({ storyLevel, level }, STATE_TYPES.INTRO),
      levelId: level?.id ?? levelDocId ?? null,
      gameId: game?.id ?? gameDocId ?? null,
    });
  }

  // 2) POSES
  const poseIds = Array.from(new Set(getPoseIds(level))).filter(Boolean);
  const cursorDelayMS = resolveCursorDelayMS({ storyLevel, level }, STATE_TYPES.POSE_MATCH);

  // ✅ ONE TWEEN node for all transitions (only if 2+ poses)
  if (poseIds.length >= 2 && STATE_TYPES.TWEEN) {
    nodes.push({
      type: STATE_TYPES.TWEEN,
      poseIds,
      stepDurationMS: level?.tweenDurationMS ?? storyLevel?.tweenDurationMS ?? 600,
      easing: level?.tweenEasing ?? storyLevel?.tweenEasing ?? "easeInOut",
      cursorDelayMS,
      levelId: level?.id ?? levelDocId ?? null,
    });
  }

  // ✅ ONE POSE_MATCH node for all targets (only if 1+ poses)
  if (poseIds.length >= 1) {
    nodes.push({
      type: STATE_TYPES.POSE_MATCH,
      poseIds,
      threshold: level?.poseThreshold ?? storyLevel?.poseThreshold ?? 60,
      cursorDelayMS,
      stepDurationMS: level?.poseDurationMS ?? storyLevel?.poseDurationMS ?? undefined,
      levelId: level?.id ?? levelDocId ?? null,
    });
  }

  // 3) OUTRO
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

  console.log(nodes)
  return nodes;
}
