"use client";

import { STATE_TYPES, normalizeStateType } from "../states/_shared/stateTypes";

// Accept 0..1 or 0..100; output 0..100
function toPct(value) {
  const t = Number(value);
  if (!Number.isFinite(t)) return null;
  return t <= 1 ? t * 100 : t;
}

function clampPct(v, fallback = 70) {
  const n = toPct(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function getPoseThresholdPctForStep(node, stepIndex, fallback = 70) {
  // 1) node.poseTolerances[stepIndex]
  const arr = Array.isArray(node?.poseTolerances) ? node.poseTolerances : null;
  const fromArray =
    arr && stepIndex >= 0 && stepIndex < arr.length ? arr[stepIndex] : undefined;
  if (fromArray !== undefined && fromArray !== null && fromArray !== "") {
    return clampPct(fromArray, fallback);
  }

  // 2) node.defaultTolerance / node.threshold
  const nodeDefault = node?.defaultTolerance ?? node?.threshold;
  if (nodeDefault !== undefined && nodeDefault !== null && nodeDefault !== "") {
    return clampPct(nodeDefault, fallback);
  }

  return fallback;
}

/**
 * NEXT handler factory.
 * Pure + deterministic.
 *
 * Supports:
 * - INTRO/OUTRO: dialogueIndex stepping
 * - INTUITION: advance to next node (answer handled elsewhere)
 * - TWEEN: stepIndex over transitions (poseIds[i] -> poseIds[i+1])
 * - POSE_MATCH: stepIndex over poseIds targets (and updates poseMatch block)
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

  function handleIntuitionNext(session) {
    // Don’t let any auto timers accidentally double-advance
    let s = cancelTimersByTag(session, "cursorDelay");
    s = cancelTimersByTag(s, `auto:${session.nodeIndex}`);

    s = pushEffect(s, {
      type: "TELEMETRY_EVENT",
      event: {
        type: "INTUITION_NEXT",
        at: s.time.now,
        nodeIndex: s.nodeIndex,
        stateType: STATE_TYPES.INTUITION,
        // if your commands.next passes payload, you can store it in session elsewhere
        answer: typeof s?.intuition?.answer === "boolean" ? s.intuition.answer : null,
      },
    });

    return goNextNode(s, { reason: "INTUITION_ANSWERED" });
  }

  function handleTweenNext(session) {
    const node = currentNode(session);
    const poseIds = Array.isArray(node?.poseIds) ? node.poseIds : [];
    const transitions = Math.max(0, poseIds.length - 1);
    const i = session.stepIndex ?? 0;

    if (transitions <= 0) return goNextNode(session, { reason: "TWEEN_EMPTY" });

    // advance within same node
    if (i + 1 < transitions) {
      const nextStep = i + 1;
      const fromPoseId = poseIds[nextStep]; // after increment, transition is (poseIds[nextStep] -> poseIds[nextStep+1])
      const toPoseId = poseIds[nextStep + 1];

      const s = { ...session, stepIndex: nextStep };
      return pushEffect(s, {
        type: "TELEMETRY_EVENT",
        event: {
          type: "TWEEN_STEP",
          at: s.time.now,
          nodeIndex: s.nodeIndex,
          stateType: STATE_TYPES.TWEEN,
          stepIndex: s.stepIndex,
          fromPoseId,
          toPoseId,
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
      const nextStep = i + 1;
      const nextTargetPoseId = poseIds[nextStep] ?? null;
      const nextThresholdPct = getPoseThresholdPctForStep(node, nextStep, 70);

      const s = {
        ...session,
        stepIndex: nextStep,
        flags: { ...session.flags, showCursor: false },
        poseMatch: {
          ...(session.poseMatch ?? {}),
          overall: 0,
          perSegment: [],
          matched: false,
          targetPoseId: nextTargetPoseId,
          thresholdPct: nextThresholdPct,
          stepIndex: nextStep,
          updatedAt: session.time.now,
        },
      };

      return pushEffect(s, {
        type: "TELEMETRY_EVENT",
        event: {
          type: "POSE_MATCH_NEXT_TARGET",
          at: s.time.now,
          nodeIndex: s.nodeIndex,
          stateType: STATE_TYPES.POSE_MATCH,
          stepIndex: s.stepIndex,
          targetPoseId: nextTargetPoseId,
          thresholdPct: nextThresholdPct,
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
    [STATE_TYPES.INTUITION]: handleIntuitionNext,
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
