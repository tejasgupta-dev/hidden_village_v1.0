/**
 * State machine registry + node/controller lookup.
 *
 * A "node" is one element of level.stateNodes:
 *   { type: STATE_TYPES.DIALOGUE, ... }
 *   { type: STATE_TYPES.TWEEN, ... }
 *
 * Controllers are modules that may implement:
 *   enter(session, node) -> session | { session, effects? }
 *   update(session, node, tickInfo) -> session | { session, effects? }
 *   handleCommand(session, node, command) -> session | { session, effects? }
 *   exit(session, node) -> session | { session, effects? }
 */

import {
  STATE_TYPES,
  normalizeStateType,
  isValidStateType,
} from "../states/_shared/stateTypes";

// Controllers
import { introController } from "../states/intro/controller";
import { dialogueController } from "../states/dialogue/controller";
import { tweenController } from "../states/tween/controller";
import { poseMatchController } from "../states/poseMatch/controller";
import { insightController } from "../states/insight/controller";
import { outroController } from "../states/outro/controller";

/**
 * Controllers registry.
 * Add new states here and you’re done.
 */
const CONTROLLERS = Object.freeze({
  [STATE_TYPES.INTRO]: introController,
  [STATE_TYPES.DIALOGUE]: dialogueController,
  [STATE_TYPES.TWEEN]: tweenController,
  [STATE_TYPES.POSE_MATCH]: poseMatchController,
  [STATE_TYPES.INSIGHT]: insightController,
  [STATE_TYPES.OUTRO]: outroController,
});

/**
 * Returns the node type as a normalized string.
 * Accepts some legacy aliases via normalizeStateType().
 */
export function getNodeType(node) {
  return normalizeStateType(node?.type ?? node?.state ?? null);
}

/**
 * Get controller for a given node.
 * If unknown state type, returns a no-op controller so runtime doesn't crash.
 */
export function getController(node) {
  const type = getNodeType(node);
  if (!type) return noopController("missing_type");
  return CONTROLLERS[type] ?? noopController(type);
}

/**
 * Validate a node minimally (helps catch bad content early).
 * Returns { ok: boolean, error?: string } instead of throwing.
 */
export function validateNode(node) {
  const type = getNodeType(node);
  if (!type) return { ok: false, error: "Node missing 'type'." };

  if (!isValidStateType(type)) {
    return { ok: false, error: `Unknown node type '${type}'.` };
  }

  if (!CONTROLLERS[type]) {
    return { ok: false, error: `No controller registered for node type '${type}'.` };
  }

  // Minimal per-type checks
  if (type === STATE_TYPES.DIALOGUE) {
    const lines = node?.lines ?? node?.dialogues ?? null;
    if (!Array.isArray(lines) || lines.length === 0) {
      return {
        ok: false,
        error: "Dialogue node requires non-empty 'lines' (or 'dialogues').",
      };
    }
  }

  if (type === STATE_TYPES.TWEEN) {
    const ms = node?.durationMS ?? node?.durationMs ?? null;
    if (ms != null && !(typeof ms === "number" && ms >= 0)) {
      return { ok: false, error: "Tween node 'durationMS' must be a number >= 0." };
    }
  }

  if (type === STATE_TYPES.POSE_MATCH) {
    // Optional: tighten validation later if you want
    // Example checks you might enforce:
    // const threshold = node?.threshold;
    // if (threshold != null && !(typeof threshold === "number" && threshold >= 0 && threshold <= 1)) ...
  }

  return { ok: true };
}

/**
 * Validate a full node list.
 */
export function validateNodeList(nodes) {
  if (!Array.isArray(nodes)) {
    return { ok: false, error: "stateNodes must be an array." };
  }
  for (let i = 0; i < nodes.length; i++) {
    const res = validateNode(nodes[i]);
    if (!res.ok) return { ok: false, error: `Node[${i}]: ${res.error}` };
  }
  return { ok: true };
}

/**
 * Whether a node should be treated as terminal (end of level/session).
 */
export function isTerminalNode(node) {
  const type = getNodeType(node);
  return type === STATE_TYPES.OUTRO || node?.terminal === true;
}

/**
 * Helper: return a safe view of the machine (useful for debugging)
 */
export function listRegisteredStates() {
  return Object.freeze(Object.keys(CONTROLLERS));
}

/* ---------------------------- No-op controller ---------------------------- */

function noopController(type) {
  return {
    type: type ?? "unknown",
    enter(session /*, node */) {
      return session;
    },
    update(session /*, node, tick */) {
      return session;
    },
    handleCommand(session /*, node, command */) {
      return session;
    },
    exit(session /*, node */) {
      return session;
    },
  };
}
