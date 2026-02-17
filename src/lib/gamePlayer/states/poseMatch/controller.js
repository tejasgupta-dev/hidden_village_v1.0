"use client";

import { STATE_TYPES } from "../_shared/stateTypes";
import { createController, emitTelemetry, emitStateEvent } from "../_shared/baseController";

/**
 * PoseMatch node format example:
 * {
 *   type: STATE_TYPES.POSE_MATCH,
 *   targetPoseId?: "pose_3",
 *   threshold?: 0.85,
 *   maxDurationMS?: 8000,      // optional: UI might auto-fail after
 *   successAdvance?: true      // if true, UI dispatches NEXT when matched
 * }
 *
 * Actual matching runs in View/hook and can dispatch:
 *   { type:"COMMAND", name:"POSE_MATCH_RESULT", payload:{ score, matched } }
 *   and/or dispatch NEXT on matched.
 */
export const poseMatchController = createController({
  type: STATE_TYPES.POSE_MATCH,

  enter(session, node) {
    let next = session;

    next = emitStateEvent(next, "STATE_ENTER", next.nodeIndex, STATE_TYPES.POSE_MATCH);

    next = emitTelemetry(next, {
      type: "POSE_MATCH_ENTER",
      at: next.time?.now,
      nodeIndex: next.nodeIndex,
      targetPoseId: node?.targetPoseId ?? null,
      threshold: node?.threshold ?? null,
      maxDurationMS: node?.maxDurationMS ?? null,
    });

    // Hint to root that this state wants pose frames
    next = emitTelemetry(next, {
      type: "POSE_RECORDING_START",
      at: next.time?.now,
      nodeIndex: next.nodeIndex,
      stateType: STATE_TYPES.POSE_MATCH,
    });

    return next;
  },

  handleCommand(session, node, command) {
    if (command?.name === "POSE_MATCH_RESULT") {
      const payload = command?.payload ?? {};
      return emitTelemetry(session, {
        type: "POSE_MATCH_RESULT",
        at: session.time?.now,
        nodeIndex: session.nodeIndex,
        score: payload.score ?? null,
        matched: payload.matched ?? null,
        details: payload.details ?? null,
      });
    }

    if (command?.name === "NEXT") {
      return emitTelemetry(session, {
        type: "POSE_MATCH_NEXT",
        at: session.time?.now,
        nodeIndex: session.nodeIndex,
      });
    }

    return session;
  },

  exit(session) {
    let next = emitTelemetry(session, {
      type: "POSE_MATCH_EXIT",
      at: session.time?.now,
      nodeIndex: session.nodeIndex,
    });

    next = emitTelemetry(next, {
      type: "POSE_RECORDING_STOP",
      at: next.time?.now,
      nodeIndex: next.nodeIndex,
      stateType: STATE_TYPES.POSE_MATCH,
    });

    next = emitStateEvent(next, "STATE_EXIT", next.nodeIndex, STATE_TYPES.POSE_MATCH);
    return next;
  },
});
