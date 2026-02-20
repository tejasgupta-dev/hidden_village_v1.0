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
  console.log("createsession levels:  ", levels)

  const levelIndex =
    typeof initialLevel === "number" && initialLevel >= 0 ? initialLevel : 0;

  const levelObj = levels[levelIndex] ?? null;
  if (!levelObj) {
    throw new Error(`createSession: level not found at index ${levelIndex}`);
  }

  // ✅ RTDB: levels are plain objects
  const settings = mergeSettings(DEFAULT_SETTINGS, levelObj?.settings ?? {});

  // ✅ RTDB: there are no authored nodes in DB (but keep support if you add later)
  let levelStateNodes =
    levelObj?.stateNodes ??
    levelObj?.states ??
    levelObj?.nodes ??
    null;

  // ✅ Always build dynamically if none provided
  if (!Array.isArray(levelStateNodes) || levelStateNodes.length === 0) {
    levelStateNodes = buildStateNodesForLevel({
      level: levelObj,  // ✅ pass plain object
      story: game,      // ✅ full game (contains storyline)
      levelIndex,
    });
  }

  if (!Array.isArray(levelStateNodes)) levelStateNodes = [];

  if (levelStateNodes.length === 0) {
    const lvlId = levelObj?.id ?? `(index ${levelIndex})`;
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

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    version: 1,

    playId,
    gameId: game.id ?? null,
    levelId: levelObj?.id ?? null,

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
