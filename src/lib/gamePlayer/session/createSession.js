"use client";

import { buildStateNodesForLevel } from "./buildStateNodesForLevel";

const DEFAULT_FLAGS = {
  paused: false,
  showCursor: true,
  showPoseDrawer: true,
  showPauseMenu: true,
  showSettings: false,
};

const DEFAULT_SETTINGS = {
  cursor: {
    sensitivity: 1.5,
    delayMS: 600,
  },
  pose: {
    enabled: true,
    logFPS: 15,
  },
  ui: {
    dialogueFontSize: 20,
  },
};

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

export function createSession({
  game,
  playId = null,
  initialLevel = 0,
  initialNodeIndex = 0,
}) {
  if (!game) {
    throw new Error("createSession: 'game' is required");
  }

  const levels = Array.isArray(game.levels) ? game.levels : [];
  const storyline = Array.isArray(game.storyline) ? game.storyline : [];

  const levelIndex =
    typeof initialLevel === "number" && initialLevel >= 0 ? initialLevel : 0;

  const levelRaw = levels[levelIndex];
  if (!levelRaw) {
    throw new Error(`createSession: level not found at index ${levelIndex}`);
  }

  // Important: level might be a Firestore doc or plain object
  const { data: levelObj } = unwrapDoc(levelRaw);

  const settings = mergeSettings(DEFAULT_SETTINGS, levelObj?.settings ?? {});

  // Story for this level index (intro/outro)
  const storyRaw = storyline[levelIndex] ?? null;

  // Prefer explicit authored nodes if you ever add them later (on level)
  let levelStateNodes =
    levelObj?.stateNodes ??
    levelObj?.states ??
    levelObj?.nodes ??
    null;

  if (!Array.isArray(levelStateNodes) || levelStateNodes.length === 0) {
    levelStateNodes = buildStateNodesForLevel({
      level: levelRaw, // pass raw, builder can unwrap
      story: storyRaw, // raw story node (plain or doc)
    });
  }

  if (!Array.isArray(levelStateNodes)) levelStateNodes = [];

  // No defaults: if builder produced nothing, fail loudly with a helpful message
  if (levelStateNodes.length === 0) {
    const lvlId = levelObj?.id ?? unwrapDoc(levelRaw).id ?? "(missing id)";
    throw new Error(
      `No playable states for level ${lvlId}. ` +
        `Expected: game.storyline[${levelIndex}] to include intro/outro dialogues ` +
        `and/or game.levels[${levelIndex}].poses to include poses.`
    );
  }

  const nodeIndex =
    typeof initialNodeIndex === "number" && initialNodeIndex >= 0
      ? Math.min(initialNodeIndex, Math.max(0, levelStateNodes.length - 1))
      : 0;

  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    version: 1,

    playId,
    gameId: game.id ?? null,
    levelId: levelObj?.id ?? unwrapDoc(levelRaw).id ?? null,

    game,
    levelIndex,

    levelStateNodes,
    nodeIndex,
    node: levelStateNodes[nodeIndex] ?? null,

    dialogueIndex: 0,

    time: {
      startedAt: now,
      now,
      elapsed: 0,
      dt: 0,
    },

    flags: { ...DEFAULT_FLAGS },
    settings,

    timers: [],
    effects: [],
  };
}

/* ---------------------------- helpers ---------------------------- */

function mergeSettings(defaults, overrides) {
  const o = overrides ?? {};
  return {
    ...defaults,
    ...o,
    cursor: { ...defaults.cursor, ...(o.cursor ?? {}) },
    pose: { ...defaults.pose, ...(o.pose ?? {}) },
    ui: { ...defaults.ui, ...(o.ui ?? {}) },
  };
}
