"use client";

import { STATE_TYPES } from "../_shared/stateTypes";
import { createController, emitTelemetry, emitStateEvent } from "../_shared/baseController";

/**
 * Tween node format example:
 * {
 *   type: STATE_TYPES.TWEEN,
 *   fromPoseId?: "pose_1",
 *   toPoseId?: "pose_2",
 *   durationMS?: 1000,
 *   easing?: "linear" | "easeInOut" | ...
 * }
 *
 * View runs tween and when finished dispatches:
 *   dispatch({ type:"COMMAND", name:"TWEEN_FINISHED" })
 * or dispatch NEXT if you want tween to always advance.
 */
export const tweenController = createController({
  type: STATE_TYPES.TWEEN,

  enter(session, node) {
    let next = session;

    next = emitStateEvent(next, "STATE_ENTER", next.nodeIndex, STATE_TYPES.TWEEN);

    next = emitTelemetry(next, {
      type: "TWEEN_ENTER",
      at: next.time?.now,
      nodeIndex: next.nodeIndex,
      fromPoseId: node?.fromPoseId ?? null,
      toPoseId: node?.toPoseId ?? null,
      durationMS: node?.durationMS ?? null,
      easing: node?.easing ?? null,
    });

    return next;
  },

  handleCommand(session, node, command) {
    if (command?.name === "TWEEN_FINISHED") {
      return emitTelemetry(session, {
        type: "TWEEN_FINISHED",
        at: session.time?.now,
        nodeIndex: session.nodeIndex,
      });
    }

    if (command?.name === "NEXT") {
      return emitTelemetry(session, {
        type: "TWEEN_NEXT",
        at: session.time?.now,
        nodeIndex: session.nodeIndex,
      });
    }

    return session;
  },

  exit(session) {
    let next = emitTelemetry(session, {
      type: "TWEEN_EXIT",
      at: session.time?.now,
      nodeIndex: session.nodeIndex,
    });

    next = emitStateEvent(next, "STATE_EXIT", next.nodeIndex, STATE_TYPES.TWEEN);
    return next;
  },
});
