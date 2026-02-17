"use client";

import { STATE_TYPES } from "../_shared/stateTypes";
import {
  createController,
  emitStateEvent,
  emitTelemetry,
  cancelTimerTag,
} from "../_shared/baseController";

/**
 * Intro node format example:
 * {
 *   type: STATE_TYPES.INTRO,
 *   lines: ["Hi...", "Do this next...", ...],     // dialogues shown in intro
 *   speaker: { name: "Guide", avatarUrl?: "..." } // optional
 *   cursorDelayMS?: 600                           // optional override (reducer can use)
 *   autoAdvanceMS?: number                        // optional (skip-able)
 * }
 *
 * IMPORTANT:
 * - Reducer handles dialogue progression on NEXT for intro/outro/dialogue.
 * - This controller mainly resets dialogue index + telemetry + optional auto timers.
 */

export const introController = createController({
  type: STATE_TYPES.INTRO,

  enter(session, node) {
    let next = session;

    // Reset dialogue index whenever we enter intro
    if (next.dialogueIndex !== 0) {
      next = { ...next, dialogueIndex: 0 };
    }

    next = emitStateEvent(next, "STATE_ENTER", next.nodeIndex, STATE_TYPES.INTRO);

    // Optional: schedule an auto-advance timer if you want intro to progress without user
    // (Reducer already understands AUTO_ADVANCE)
    next = cancelTimerTag(next, `intro:${next.nodeIndex}`);

    const autoMS = node?.autoAdvanceMS ?? node?.durationMS ?? null;
    if (autoMS && autoMS > 0) {
      // We just emit telemetry here; actual scheduling is better done in reducer
      // via node.autoAdvanceMS. If you prefer controller-based scheduling, add scheduleTimerIn.
      next = emitTelemetry(next, {
        type: "INTRO_AUTO_ADVANCE_CONFIGURED",
        at: next.time?.now,
        nodeIndex: next.nodeIndex,
        autoAdvanceMS: autoMS,
      });
    }

    return next;
  },

  update(session) {
    return session;
  },

  handleCommand(session, node, command) {
    // Reducer handles NEXT logic; controller can log “skip intent” if you want.
    if (command?.name === "NEXT") {
      return emitTelemetry(session, {
        type: "INTRO_NEXT",
        at: session.time?.now,
        nodeIndex: session.nodeIndex,
      });
    }
    return session;
  },

  exit(session) {
    let next = session;
    next = cancelTimerTag(next, `intro:${next.nodeIndex}`);
    next = emitStateEvent(next, "STATE_EXIT", next.nodeIndex, STATE_TYPES.INTRO);
    return next;
  },
});
