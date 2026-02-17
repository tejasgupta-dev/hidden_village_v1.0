"use client";

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

/**
 * Creates the initial session object for a given game and level.
 *
 * Expected (flexible) game format:
 * - game.id
 * - game.levels[levelIndex]
 * - level.id
 * - level.settings (optional)
 * - level.stateNodes OR level.states OR (fallback) level.dialogues
 *
 * State node examples:
 * - { type: "dialogue", lines: [...], speaker: "..." }
 * - { type: "tween", durationMS: 1000, ... }
 * - { type: "poseMatch", targetPoseId: "...", threshold: 0.85 }
 */
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
  const levelIndex =
    typeof initialLevel === "number" && initialLevel >= 0 ? initialLevel : 0;

  const level = levels[levelIndex];
  if (!level) {
    throw new Error(`createSession: level not found at index ${levelIndex}`);
  }

  const levelSettings = level.settings ?? {};
  const settings = mergeSettings(DEFAULT_SETTINGS, levelSettings);

  // Support multiple naming conventions to ease migration
  let levelStateNodes =
    level.stateNodes ??
    level.states ??
    level.nodes ??
    null;

  // If older format: "dialogues" array exists but no nodes, wrap into a single dialogue node.
  if (!levelStateNodes) {
    if (Array.isArray(level.dialogues) && level.dialogues.length > 0) {
      levelStateNodes = [
        { type: "dialogue", lines: level.dialogues, speaker: level.speaker ?? null },
      ];
    } else {
      levelStateNodes = [];
    }
  }

  if (!Array.isArray(levelStateNodes)) levelStateNodes = [];

  const nodeIndex =
    typeof initialNodeIndex === "number" && initialNodeIndex >= 0
      ? Math.min(initialNodeIndex, Math.max(0, levelStateNodes.length - 1))
      : 0;

  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const session = {
    version: 1,

    playId,
    gameId: game.id ?? null,
    levelId: level.id ?? null,

    // keep original game data available (root can use for sprites/background)
    game,
    levelIndex,

    // runtime node list
    levelStateNodes,
    nodeIndex,
    node: levelStateNodes[nodeIndex] ?? null,

    // dialogue runtime
    dialogueIndex: 0,

    // time bookkeeping
    time: {
      startedAt: now,
      now,
      elapsed: 0,
      dt: 0,
    },

    // UI + gameplay flags
    flags: { ...DEFAULT_FLAGS },

    // merged settings
    settings,

    // tick-driven timers (no setTimeout needed)
    timers: [],

    // side effects (telemetry, pose start/stop, etc.)
    effects: [],
  };

  return session;
}

/* ---------------------------- helpers ---------------------------- */

function mergeSettings(defaults, overrides) {
  // Only merges known subtrees (cursor/pose/ui) shallowly for safety.
  const o = overrides ?? {};
  return {
    ...defaults,
    ...o,
    cursor: { ...defaults.cursor, ...(o.cursor ?? {}) },
    pose: { ...defaults.pose, ...(o.pose ?? {}) },
    ui: { ...defaults.ui, ...(o.ui ?? {}) },
  };
}
