/**
 * Canonical state type constants.
 * 
 * All stateNodes in your level definitions should use one of these.
 * Example:
 *   { type: STATE_TYPES.DIALOGUE, lines: [...] }
 */

export const STATE_TYPES = Object.freeze({
  INTRO: "intro",
  DIALOGUE: "dialogue",
  TWEEN: "tween",
  POSE_MATCH: "poseMatch",
  INSIGHT: "insight",
  OUTRO: "outro",
});

/**
 * Optional helper: list of all valid types.
 */
export const ALL_STATE_TYPES = Object.freeze(Object.values(STATE_TYPES));

/**
 * Normalize a raw node.type string.
 * Handles legacy aliases for migration.
 */
export function normalizeStateType(raw) {
  if (!raw) return null;

  const t = String(raw);

  // Legacy aliases — extend as needed
  if (t === "pose_match" || t === "pose-match") return STATE_TYPES.POSE_MATCH;
  if (t === "dialog" || t === "speech") return STATE_TYPES.DIALOGUE;
  if (t === "ending") return STATE_TYPES.OUTRO;

  return t;
}

/**
 * Quick validation helper.
 */
export function isValidStateType(type) {
  return ALL_STATE_TYPES.includes(type);
}
