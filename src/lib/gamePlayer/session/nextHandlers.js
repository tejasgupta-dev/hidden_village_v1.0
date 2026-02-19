"use client";

import { STATE_TYPES, normalizeStateType } from "../states/_shared/stateTypes";

/**
 * NEXT handler factory.
 * Pure + deterministic.
 *
 * Supports:
 * - INTRO/OUTRO: dialogueIndex stepping
 * - TWEEN: stepIndex over transitions (poseIds[i] -> poseIds[i+1])
 * - POSE_MATCH: stepIndex over poseIds targets
 */
export function createNextHandler({
  currentNode,
  pushEffect,
  cancelTimersByTag,
  scheduleCursorIfDialogueLike,
  maybeScheduleAutoAdvance,
  goNextNode,
}) {
  function handleDialogueLikeNext(session) {
    const node = currentNode(session);
    const t = normalizeStateType(node?.type ?? node?.state ?? null);

    const lines = node?.lines ?? node?.dialogues ?? [];
    const nextDialogueIndex = (session.dialogueIndex ?? 0) + 1;

    if (Array.isArray(lines) && lines.length > 0) {
      let s = cancelTimersByTag(session, `auto:${session.nodeIndex}`);

      if (nextDialogueIndex < lines.length) {
        s = {
          ...s,
          dialogueIndex: nextDialogueIndex,
          flags: { ...s.flags, showCursor: false },
        };

        s = cancelTimersByTag(s, "cursorDelay");

        s = pushEffect(s, {
          type: "TELEMETRY_EVENT",
          event: {
            type: "DIALOGUE_NEXT",
            at: s.time.now,
            nodeIndex: s.nodeIndex,
            stateType: t,
            dialogueIndex: nextDialogueIndex,
          },
        });

        s = scheduleCursorIfDialogueLike(s);
        s = maybeScheduleAutoAdvance(s);
        return s;
      }

      // dialogue finished -> next node
      let s2 = pushEffect(session, {
        type: "TELEMETRY_EVENT",
        event: {
          type: "DIALOGUE_END",
          at: session.time.now,
          nodeIndex: session.nodeIndex,
          stateType: t,
        },
      });

      s2 = cancelTimersByTag(s2, "cursorDelay");
      s2 = cancelTimersByTag(s2, `auto:${session.nodeIndex}`);

      return goNextNode(s2, { reason: "DIALOGUE_FINISHED" });
    }

    return goNextNode(session, { reason: "NO_DIALOGUE_LINES" });
  }

  function handleTweenNext(session) {
    const node = currentNode(session);
    const poseIds = Array.isArray(node?.poseIds) ? node.poseIds : [];
    const transitions = Math.max(0, poseIds.length - 1);
    const i = session.stepIndex ?? 0;

    if (transitions <= 0) return goNextNode(session, { reason: "TWEEN_EMPTY" });

    // advance within same node
    if (i + 1 < transitions) {
      const s = { ...session, stepIndex: i + 1 };
      return pushEffect(s, {
        type: "TELEMETRY_EVENT",
        event: {
          type: "TWEEN_STEP",
          at: s.time.now,
          nodeIndex: s.nodeIndex,
          stateType: STATE_TYPES.TWEEN,
          stepIndex: s.stepIndex,
          fromPoseId: poseIds[s.stepIndex],
          toPoseId: poseIds[s.stepIndex + 1],
        },
      });
    }

    return goNextNode(session, { reason: "TWEEN_FINISHED" });
  }

  function handlePoseMatchNext(session) {
    const node = currentNode(session);
    const poseIds = Array.isArray(node?.poseIds) ? node.poseIds : [];
    const i = session.stepIndex ?? 0;

    if (poseIds.length <= 0) return goNextNode(session, { reason: "POSE_MATCH_EMPTY" });

    // advance within same node
    if (i + 1 < poseIds.length) {
      const s = { ...session, stepIndex: i + 1 };
      return pushEffect(s, {
        type: "TELEMETRY_EVENT",
        event: {
          type: "POSE_MATCH_NEXT_TARGET",
          at: s.time.now,
          nodeIndex: s.nodeIndex,
          stateType: STATE_TYPES.POSE_MATCH,
          stepIndex: s.stepIndex,
          targetPoseId: poseIds[s.stepIndex],
        },
      });
    }

    return goNextNode(session, { reason: "POSE_MATCH_FINISHED" });
  }

  function handleDefaultNext(session) {
    return goNextNode(session, { reason: "NEXT_COMMAND" });
  }

  const handlers = {
    [STATE_TYPES.INTRO]: handleDialogueLikeNext,
    [STATE_TYPES.OUTRO]: handleDialogueLikeNext,
    [STATE_TYPES.TWEEN]: handleTweenNext,
    [STATE_TYPES.POSE_MATCH]: handlePoseMatchNext,
  };

  return function handleNext(session) {
    const node = currentNode(session);
    const t = normalizeStateType(node?.type ?? node?.state ?? null);
    const fn = handlers[t] ?? handleDefaultNext;
    return fn(session);
  };
}
