"use client";

import { STATE_TYPES } from "@/lib/gamePlayer/states/_shared/stateTypes";

/**
 * Build stateNodes from:
 * - story (game.storyline[levelIndex]) -> intro/outro dialogues
 * - level (game.levels[levelIndex])    -> poses
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

function readLines(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  return [];
}

function normalizePoseId(pose) {
  return pose?.id ?? pose?.poseId ?? pose?.key ?? null;
}

function resolveCursorDelayMS({ story, level }, nodeType) {
  // prefer more specific > generic > settings
  if (nodeType === STATE_TYPES.INTRO) {
    return (
      story?.introCursorDelayMS ??
      story?.cursorDelayMS ??
      level?.introCursorDelayMS ??
      level?.cursorDelayMS ??
      level?.settings?.cursor?.delayMS ??
      undefined
    );
  }

  if (nodeType === STATE_TYPES.OUTRO) {
    return (
      story?.outroCursorDelayMS ??
      story?.cursorDelayMS ??
      level?.outroCursorDelayMS ??
      level?.cursorDelayMS ??
      level?.settings?.cursor?.delayMS ??
      undefined
    );
  }

  // pose/tween
  return (
    story?.poseCursorDelayMS ??
    story?.cursorDelayMS ??
    level?.poseCursorDelayMS ??
    level?.cursorDelayMS ??
    level?.settings?.cursor?.delayMS ??
    undefined
  );
}

export function buildStateNodesForLevel({ level: levelInput, story: storyInput }) {
  const { id: levelDocId, data: level } = unwrapDoc(levelInput);
  const { id: storyDocId, data: story } = unwrapDoc(storyInput);

  const nodes = [];

  // 1) INTRO (from STORY)
  const introLines = readLines(story, [
    "introLines",
    "introDialogues",
    "introDialogue",
    "intro",
  ]);

  if (introLines.length > 0) {
    nodes.push({
      type: STATE_TYPES.INTRO,
      lines: introLines,
      speaker: story?.introSpeaker ?? story?.speaker ?? { name: "Guide" },
      cursorDelayMS: resolveCursorDelayMS({ story, level }, STATE_TYPES.INTRO),

      // optional debug
      levelId: level?.id ?? levelDocId ?? null,
      storyId: story?.id ?? storyDocId ?? null,
    });
  }

  // 2) POSES (from LEVEL)
  const poses = Array.isArray(level?.poses) ? level.poses : [];
  const poseIds = poses.map(normalizePoseId).filter(Boolean);

  for (let i = 0; i < poseIds.length; i++) {
    const toPoseId = poseIds[i];
    const fromPoseId = i > 0 ? poseIds[i - 1] : null;

    const cursorDelayMS = resolveCursorDelayMS({ story, level }, STATE_TYPES.POSE_MATCH);

    // Tween between poses (skip first)
    if (fromPoseId) {
      nodes.push({
        type: STATE_TYPES.TWEEN,
        fromPoseId,
        toPoseId,
        durationMS: level?.tweenDurationMS ?? 600,
        easing: level?.tweenEasing ?? "easeInOut",
        cursorDelayMS,

        levelId: level?.id ?? levelDocId ?? null,
      });
    }

    nodes.push({
      type: STATE_TYPES.POSE_MATCH,
      targetPoseId: toPoseId,
      threshold: level?.poseThreshold ?? 0.85,
      cursorDelayMS,

      levelId: level?.id ?? levelDocId ?? null,
    });
  }

  // 3) OUTRO (from STORY)
  const outroLines = readLines(story, [
    "outroLines",
    "outroDialogues",
    "outroDialogue",
    "outro",
  ]);

  if (outroLines.length > 0) {
    nodes.push({
      type: STATE_TYPES.OUTRO,
      lines: outroLines,
      speaker: story?.outroSpeaker ?? story?.speaker ?? { name: "Guide" },
      cursorDelayMS: resolveCursorDelayMS({ story, level }, STATE_TYPES.OUTRO),

      levelId: level?.id ?? levelDocId ?? null,
      storyId: story?.id ?? storyDocId ?? null,
    });
  }

  return nodes;
}
