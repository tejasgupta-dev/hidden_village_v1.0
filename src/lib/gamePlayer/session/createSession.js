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
  logFPS: 15,

  // Which body-part groups to include in similarity
  include: {
    face: false,
    leftArm: true,
    rightArm: true,
    leftLeg: true,
    rightLeg: true,
    hands: false,
  },

  // Which state types should exist/render in this level
  states: {
    intro: true,
    intuition: true,
    tween: true,
    poseMatch: true,
    insight: true,
    outro: true,
  },

  // Repetitions
  reps: {
    poseMatch: 3,
    tween: 3,
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
  console.log("createsession levels:", levels);

  const levelIndex =
    typeof initialLevel === "number" && initialLevel >= 0
      ? initialLevel
      : 0;

  const levelObj = levels[levelIndex] ?? null;
  if (!levelObj) {
    throw new Error(`createSession: level not found at index ${levelIndex}`);
  }

  const settings = mergeSettings(
    DEFAULT_SETTINGS,
    levelObj?.settings ?? {}
  );

  let nodes = buildStateNodesForLevel({
    level: levelObj,
    story: game,
    levelIndex,
  });

  if (!Array.isArray(nodes)) nodes = [];

  if (nodes.length === 0) {
    const lvlId = levelObj?.id ?? `(index ${levelIndex})`;
    throw new Error(
      `No playable states for level ${lvlId}. ` +
        `Expected storyline or poses to generate states.`
    );
  }

  const nodeIndex =
    typeof initialNodeIndex === "number" && initialNodeIndex >= 0
      ? Math.min(initialNodeIndex, Math.max(0, nodes.length - 1))
      : 0;

  const now =
    typeof performance !== "undefined"
      ? performance.now()
      : Date.now();

  return {
    version: 1,  // schema version

    playId,  // this specific playthrough
    gameId: game.id ?? null,  // which game
    levelId: levelObj?.id ?? null,  // which level

    // These don’t change during a level.
    game,  // full game object (levels, storyline, etc.)
    levelIndex,  // which level we’re currently on

    // This is what drives StateRenderer.
    nodes,  // ordered list of state nodes for this level (intro → intuition → tween → poseMatch → insight → outro)
    nodeIndex,  // current position in that list
    node: nodes[nodeIndex] ?? null,  // so we don’t constantly write session.nodes[session.nodeIndex]

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

// TODO: Move clampInt into a util file
function clampInt(n, { min = 1, max = Infinity } = {}) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  const v = Math.trunc(x);
  return Math.max(min, Math.min(max, v));
}

function mergeSettings(defaults, overrides) {
  const d = defaults ?? {};
  const o = overrides ?? {};

  const merged = {
    ...d,
    ...o,

    include: { ...(d.include ?? {}), ...(o.include ?? {}) },
    states: { ...(d.states ?? {}), ...(o.states ?? {}) },
    ui: { ...(d.ui ?? {}), ...(o.ui ?? {}) },

    reps: {
      ...(d.reps ?? {}),
      ...(o.reps ?? {}),
    },
  };

  merged.reps = {
    poseMatch: clampInt(merged.reps?.poseMatch ?? 1, {
      min: 1,
      max: 999,
    }),
    tween: clampInt(merged.reps?.tween ?? 1, {
      min: 1,
      max: 999,
    }),
  };

  merged.logFPS = clampInt(merged.logFPS ?? 15, {
    min: 1,
    max: 120,
  });

  return merged;
}