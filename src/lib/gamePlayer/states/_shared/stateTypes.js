/**
 * Canonical state type constants.
 * 
 * All stateNodes in your level definitions should use one of these.
 * Example:
 *   { type: STATE_TYPES.DIALOGUE, lines: [...] }
 */

export const STATE_TYPES = Object.freeze({
  INTRO: "intro",
  INTUITION: "intuition",
  TWEEN: "tween",
  POSE_MATCH: "poseMatch",
  INSIGHT: "insight",
  OUTRO: "outro",
});

/**
 * Optional helper: list of all valid types.
 */
export const ALL_STATE_TYPES = Object.freeze(Object.values(STATE_TYPES));

export function normalizeStateType(raw) {
  if (!raw) return null;
  const t = String(raw).trim().toLowerCase();

  // allow passing actual values OR keys
  if (t === "intro" || t === STATE_TYPES.INTRO) return STATE_TYPES.INTRO;
  if (t === "intuition" || t === STATE_TYPES.INTUITION) return STATE_TYPES.INTUITION;
  if (t === "tween" || t === STATE_TYPES.TWEEN) return STATE_TYPES.TWEEN;
  if (t === "posematch" || t === "pose_match" || t === STATE_TYPES.POSE_MATCH) return STATE_TYPES.POSE_MATCH;
  if (t === "insight" || t === STATE_TYPES.INSIGHT) return STATE_TYPES.INSIGHT;
  if (t === "outro" || t === STATE_TYPES.OUTRO) return STATE_TYPES.OUTRO;

  return t;
}

/**
 * Quick validation helper.
 */
export function isValidStateType(type) {
  return ALL_STATE_TYPES.includes(type);
}
