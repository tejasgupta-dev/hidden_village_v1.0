"use client";

/**
 * Command creators for the game session reducer.
 * Keeps UI components clean and consistent.
 *
 * Usage:
 *   import { commands } from "@/lib/gamePlayer/session/commands";
 *   dispatch(commands.next());
 *   dispatch(commands.pause());
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

  next: () => ({
    type: "COMMAND",
    name: "NEXT",
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

  /**
   * Set a setting by dot-path, e.g.:
   *   commands.setSetting("cursor.sensitivity", 1.8)
   *   commands.setSetting("pose.enabled", false)
   */
  setSetting: (path, value) => ({
    type: "COMMAND",
    name: "SET_SETTING",
    payload: { path, value },
  }),

  restartLevel: () => ({
    type: "COMMAND",
    name: "RESTART_LEVEL",
  }),

  /**
   * Optional: call when pose stream updates.
   * I recommend NOT storing the full pose in reducer state
   * (store pose in a ref in GamePlayerRoot), but this can be
   * used for quality flags or "pose last seen" timestamps.
   */
  poseUpdate: (poseMeta = {}) => ({
    type: "POSE_UPDATE",
    ...poseMeta,
  }),
});
