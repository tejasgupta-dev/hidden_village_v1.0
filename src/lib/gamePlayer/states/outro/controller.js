"use client";

import { STATE_TYPES } from "../_shared/stateTypes";
import { createController, emitTelemetry, emitStateEvent } from "../_shared/baseController";

/**
 * Outro node format:
 * {
 *   type: STATE_TYPES.OUTRO,
 *   lines: [...],              // dialogue-like; reducer advances lines on NEXT
 *   speaker?: ...
 *   cursorDelayMS?: number
 * }
 */
export const outroController = createController({
  type: STATE_TYPES.OUTRO,

  enter(session, node) {
    let next = session;

    // reducer already resets dialogueIndex for OUTRO, but explicit is fine
    if (next.dialogueIndex !== 0) next = { ...next, dialogueIndex: 0 };

    next = emitStateEvent(next, "STATE_ENTER", next.nodeIndex, STATE_TYPES.OUTRO);

    next = emitTelemetry(next, {
      type: "OUTRO_ENTER",
      at: next.time?.now,
      nodeIndex: next.nodeIndex,
      speaker: node?.speaker ?? null,
      lineCount: Array.isArray(node?.lines ?? node?.dialogues)
        ? (node?.lines ?? node?.dialogues).length
        : 0,
    });

    return next;
  },

  handleCommand(session, node, command) {
    if (command?.name === "NEXT") {
      return emitTelemetry(session, {
        type: "OUTRO_NEXT",
        at: session.time?.now,
        nodeIndex: session.nodeIndex,
      });
    }
    return session;
  },

  exit(session) {
    let next = emitTelemetry(session, {
      type: "OUTRO_EXIT",
      at: session.time?.now,
      nodeIndex: session.nodeIndex,
    });

    next = emitStateEvent(next, "STATE_EXIT", next.nodeIndex, STATE_TYPES.OUTRO);
    return next;
  },
});
