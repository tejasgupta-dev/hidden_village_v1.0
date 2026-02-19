"use client";

/**
 * Command creators for the game session reducer.
 * Keeps UI components clean and consistent.
 *
 * Usage:
 *   dispatch(commands.next({ source: "click" }));
 *   dispatch(commands.next({ source: "auto" }));
 */

export const commands = Object.freeze({
  tick: ({ now, dt, elapsed }) => ({
    type: "TICK",
    now,
    dt,
    elapsed,
  }),

  consumeEffects: () => ({
    type: "CONSUME_EFFECTS",
  }),

  /**
   * NEXT command.
   * payload.source:
   *  - "click" => manual user click (must always advance)
   *  - "auto"  => autoplay logic (may be gated by match rules)
   */
  next: (payload = { source: "click" }) => ({
    type: "COMMAND",
    name: "NEXT",
    payload,
  }),

  pause: () => ({
    type: "COMMAND",
    name: "PAUSE",
  }),

  resume: () => ({
    type: "COMMAND",
    name: "RESUME",
  }),

  toggleSettings: () => ({
    type: "COMMAND",
    name: "TOGGLE_SETTINGS",
  }),

  setSetting: (path, value) => ({
    type: "COMMAND",
    name: "SET_SETTING",
    payload: { path, value },
  }),

  restartLevel: () => ({
    type: "COMMAND",
    name: "RESTART_LEVEL",
  }),

  poseUpdate: (poseMeta = {}) => ({
    type: "POSE_UPDATE",
    ...poseMeta,
  }),
});
