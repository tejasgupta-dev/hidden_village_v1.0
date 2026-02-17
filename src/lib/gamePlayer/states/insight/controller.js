"use client";

import { STATE_TYPES } from "../_shared/stateTypes";
import { createController, emitTelemetry, emitStateEvent } from "../_shared/baseController";

/**
 * Insight node format example:
 * {
 *   type: STATE_TYPES.INSIGHT,
 *   prompt?: "Hold steady",
 *   durationMS?: 4000,          // optional auto-advance
 *   recordPose?: true,          // optional hint (root decides)
 * }
 *
 * Actual insight computation/UI lives in View + hooks.
 * When insight completes, your UI can dispatch COMMAND/NEXT (or emit a custom COMMAND).
 */
export const insightController = createController({
  type: STATE_TYPES.INSIGHT,

  enter(session, node) {
    let next = session;

    next = emitStateEvent(next, "STATE_ENTER", next.nodeIndex, STATE_TYPES.INSIGHT);

    next = emitTelemetry(next, {
      type: "INSIGHT_ENTER",
      at: next.time?.now,
      nodeIndex: next.nodeIndex,
      prompt: node?.prompt ?? null,
      recordPose: node?.recordPose ?? true,
    });

    return next;
  },

  update(session /*, node, tick */) {
    // Keep empty—your View/hook will do computations and dispatch commands.
    return session;
  },

  handleCommand(session, node, command) {
    // Let reducer handle NEXT as "advance node"
    if (command?.name === "NEXT") {
      return emitTelemetry(session, {
        type: "INSIGHT_NEXT",
        at: session.time?.now,
        nodeIndex: session.nodeIndex,
      });
    }

    // Optional: accept reported insight result from UI/hook
    if (command?.name === "INSIGHT_RESULT") {
      return emitTelemetry(session, {
        type: "INSIGHT_RESULT",
        at: session.time?.now,
        nodeIndex: session.nodeIndex,
        result: command?.payload ?? null,
      });
    }

    return session;
  },

  exit(session) {
    let next = emitTelemetry(session, {
      type: "INSIGHT_EXIT",
      at: session.time?.now,
      nodeIndex: session.nodeIndex,
    });

    next = emitStateEvent(next, "STATE_EXIT", next.nodeIndex, STATE_TYPES.INSIGHT);
    return next;
  },
});
