/**
 * Base helpers for state controllers.
 *
 * Controllers should stay "mostly pure":
 * - No fetch / DOM / setTimeout here
 * - Emit effects (telemetry, flush, etc.) for GamePlayerRoot to execute
 * - Schedule tick-driven timers via session/timers.js helpers
 */

import { scheduleIn, cancelTimersByTag } from "../../session/timers";

/* ----------------------------- effect helpers ----------------------------- */

export function pushEffect(session, effect) {
  return { ...session, effects: [...(session.effects ?? []), effect] };
}

/**
 * Normalize controller return value:
 * Controllers may return either:
 *  - session
 *  - { session, effects: [...] }
 *
 * This makes consuming code simpler.
 */
export function withEffects(result) {
  if (!result) return { session: null, effects: [] };
  if (result.session) {
    const effects = Array.isArray(result.effects) ? result.effects : [];
    return { session: result.session, effects };
  }
  return { session: result, effects: [] };
}

/* ----------------------------- telemetry helpers ----------------------------- */

export function emitTelemetry(session, event) {
  return pushEffect(session, {
    type: "TELEMETRY_EVENT",
    event,
  });
}

export function emitStateEvent(session, kind, nodeIndex, stateType, extra = {}) {
  return emitTelemetry(session, {
    type: kind, // e.g., "STATE_ENTER", "STATE_EXIT"
    at: session.time?.now,
    nodeIndex,
    stateType,
    ...extra,
  });
}

/* ----------------------------- timer helpers ----------------------------- */

/**
 * Cancel timers for this state/node by tag.
 */
export function cancelTimerTag(session, tag) {
  return cancelTimersByTag(session, tag);
}

/**
 * Schedule a timer relative to "now" using tick-driven timers.
 */
export function scheduleTimerIn(session, { tag, kind, delayMS, payload }) {
  return scheduleIn(session, { tag, kind, delayMS, payload });
}

/**
 * Standard cursor delay scheduling pattern for dialogue-like states.
 * (Controllers can call this if they want, but reducer can also own this logic.)
 */
export function scheduleCursorDelay(session, { delayMS, tag = "cursorDelay" } = {}) {
  let next = cancelTimersByTag(session, tag);

  if (!delayMS || delayMS <= 0) {
    return { ...next, flags: { ...next.flags, showCursor: true } };
  }

  return scheduleIn(next, {
    tag,
    kind: "SHOW_CURSOR",
    delayMS,
  });
}

/* ----------------------------- controller skeleton ----------------------------- */

/**
 * Optional: use this to build controllers with consistent defaults.
 * Example:
 *   export const dialogueController = createController({
 *     type: STATE_TYPES.DIALOGUE,
 *     enter(session, node) { ... },
 *     handleCommand(session, node, command) { ... }
 *   })
 */
export function createController(impl) {
  return {
    type: impl.type ?? "unknown",
    enter: impl.enter ?? ((s) => s),
    update: impl.update ?? ((s) => s),
    handleCommand: impl.handleCommand ?? ((s) => s),
    exit: impl.exit ?? ((s) => s),
  };
}
