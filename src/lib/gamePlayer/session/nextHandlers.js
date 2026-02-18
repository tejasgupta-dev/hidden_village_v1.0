"use client";

import { STATE_TYPES, normalizeStateType } from "../states/_shared/stateTypes";

/**
 * NEXT handler factory.
 * Keeps reducer clean while still pure/deterministic.
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
        let next = cancelTimersByTag(session, `auto:${session.nodeIndex}`);

        if (nextDialogueIndex < lines.length) {
        next = {
            ...next,
            dialogueIndex: nextDialogueIndex,
            flags: { ...next.flags, showCursor: false },
        };

        next = cancelTimersByTag(next, "cursorDelay");

        next = pushEffect(next, {
            type: "TELEMETRY_EVENT",
            event: {
            type: "DIALOGUE_NEXT",
            at: next.time.now,
            nodeIndex: next.nodeIndex,
            stateType: t,
            dialogueIndex: nextDialogueIndex,
            },
        });

        next = scheduleCursorIfDialogueLike(next);
        next = maybeScheduleAutoAdvance(next);
        return next;
        }

        next = pushEffect(next, {
        type: "TELEMETRY_EVENT",
        event: {
            type: "DIALOGUE_END",
            at: next.time.now,
            nodeIndex: next.nodeIndex,
            stateType: t,
        },
        });

        next = cancelTimersByTag(next, "cursorDelay");
        next = cancelTimersByTag(next, `auto:${next.nodeIndex}`);

        return goNextNode(next, { reason: "DIALOGUE_FINISHED" });
    }

    return goNextNode(session, { reason: "NO_DIALOGUE_LINES" });
    }

  function handleDefaultNext(session) {
    return goNextNode(session, { reason: "NEXT_COMMAND" });
  }

  function handlePoseMatchNext(session) {
    return goNextNode(session, { reason: "POSE_MATCH_NEXT" });
  }

  function handleTweenNext(session) {
    return goNextNode(session, { reason: "TWEEN_NEXT" });
  }

  const handlers = {
    [STATE_TYPES.INTRO]: handleDialogueLikeNext,
    [STATE_TYPES.OUTRO]: handleDialogueLikeNext,
    [STATE_TYPES.POSE_MATCH]: handlePoseMatchNext,
    [STATE_TYPES.TWEEN]: handleTweenNext,
  };

  return function handleNext(session) {
    const node = currentNode(session);
    const t = normalizeStateType(node?.type ?? node?.state ?? null);
    const fn = handlers[t] ?? handleDefaultNext;
    return fn(session);
  };
}
