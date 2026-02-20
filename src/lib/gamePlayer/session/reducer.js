"use client";

import { createSession } from "./createSession";
import { scheduleIn, cancelTimersByTag, runDueTimers } from "./timers";
import { STATE_TYPES, normalizeStateType } from "../states/_shared/stateTypes";

/* ----------------------------- small utils ----------------------------- */

function pushEffect(session, effect) {
  return { ...session, effects: [...(session.effects ?? []), effect] };
}

function clearEffects(session) {
  return { ...session, effects: [] };
}

function nodeType(node) {
  return normalizeStateType(node?.type ?? node?.state ?? null);
}

function isDialogueLikeType(t) {
  return t === STATE_TYPES.INTRO || t === STATE_TYPES.OUTRO;
}

function isSteppedPoseType(t) {
  return t === STATE_TYPES.POSE_MATCH;
}

/* ----------------------------- pose threshold helpers ----------------------------- */

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

/* ----------------------------- eventId helpers ----------------------------- */

function baseEventId(session) {
  const p = session?.playId ?? "noPlay";
  const g = session?.gameId ?? "noGame";
  const l = session?.levelId ?? "noLevel";
  return `${p}:${g}:${l}`;
}

function withEventId(session, evt) {
  if (evt?.eventId) return evt;

  const t = evt?.type ?? "UNKNOWN";
  const ni = evt?.nodeIndex ?? session?.nodeIndex ?? -1;
  const st = evt?.stateType ?? nodeType(session?.node) ?? "unknown";
  const di = evt?.dialogueIndex;
  const si = evt?.stepIndex;
  const pi = evt?.playIndex;

  const parts = [baseEventId(session), t, `n${ni}`, `s${st}`];
  if (di != null) parts.push(`d${di}`);
  if (si != null) parts.push(`k${si}`);
  if (pi != null) parts.push(`p${pi}`);

  return { ...evt, eventId: parts.join("|") };
}

function emitTelemetry(session, evt) {
  return pushEffect(session, {
    type: "TELEMETRY_EVENT",
    event: withEventId(session, evt),
  });
}

/* ----------------------------- public API ----------------------------- */

export function createInitialSession({ game, initialLevel = 0, playId = null }) {
  console.log("reducer game log:  ", game);
  let session = createSession({
    game,
    playId,
    initialLevel,
    initialNodeIndex: 0,
  });

  session = emitTelemetry(session, {
    type: "SESSION_START",
    at: session.time.now,
    levelId: session.levelId,
    gameId: session.gameId,
    playId: session.playId,
  });

  session = enterNode(session, session.nodeIndex, { reason: "INIT" });
  return session;
}

export function sessionReducer(session, action) {
  switch (action.type) {
    case "CONSUME_EFFECTS":
      return clearEffects(session);

    case "TICK": {
      const now =
        action.now ??
        (typeof performance !== "undefined" ? performance.now() : Date.now());

      if (session.flags?.paused) {
        return {
          ...session,
          time: { ...session.time, now, dt: 0, elapsed: session.time.elapsed },
        };
      }

      const dt = action.dt ?? Math.max(0, now - session.time.now);
      const elapsed = action.elapsed ?? (session.time.elapsed + dt);

      let next = { ...session, time: { ...session.time, now, dt, elapsed } };

      next = runDueTimers(next, applyTimer);
      next = scheduleAutoAdvanceIfNeeded(next);

      return next;
    }

    case "COMMAND":
      return applyCommand(session, action.name, action.payload);

    default:
      return session;
  }
}

export function applyCommand(session, name, payload) {
  switch (name) {
    case "PAUSE": {
      if (session.flags.paused) return session;

      const next = {
        ...session,
        flags: { ...session.flags, paused: true, showPauseMenu: true },
      };

      return emitTelemetry(next, { type: "PAUSE", at: session.time.now });
    }

    case "RESUME": {
      if (!session.flags.paused) return session;

      let next = {
        ...session,
        flags: { ...session.flags, paused: false, showPauseMenu: false },
      };

      next = emitTelemetry(next, { type: "RESUME", at: session.time.now });

      next = scheduleCursor(next);
      return next;
    }

    case "TOGGLE_SETTINGS":
      return {
        ...session,
        flags: { ...session.flags, showSettings: !session.flags.showSettings },
      };

    case "SET_SETTING": {
      const { path, value } = payload || {};
      if (!path) return session;

      const nextSettings = setByPath(session.settings, path, value);
      let next = { ...session, settings: nextSettings };

      next = emitTelemetry(next, {
        type: "SETTING_CHANGED",
        at: session.time.now,
        path,
        value,
      });

      return next;
    }

    /* ---------------------- Intuition (true/false) ---------------------- */

    case "TRUE_FALSE_SELECTED": {
      const answer = typeof payload?.answer === "boolean" ? payload.answer : null;

      let next = {
        ...session,
        intuition: {
          answer,
          question: payload?.question ?? null,
          levelId: payload?.levelId ?? session.levelId ?? null,
          gameId: payload?.gameId ?? session.gameId ?? null,
          nodeIndex: payload?.nodeIndex ?? session.nodeIndex ?? null,
          levelIndex: payload?.levelIndex ?? session.levelIndex ?? null,
          at: payload?.at ?? Date.now(),
        },
      };

      next = emitTelemetry(next, {
        type: "TRUE_FALSE_SELECTED",
        at: next.time.now,
        nodeIndex: next.nodeIndex,
        stateType: nodeType(currentNode(next)),

        selectedValue: answer,
        selectedLabel: answer === true ? "True" : answer === false ? "False" : null,

        // keep your existing fields too
        answer,
        question: next.intuition?.question,
      });

      return next;
    }

    /* ---------------------- Insight (option choice) ---------------------- */
    /**
     * Payload suggestions (use whatever you already have):
     * {
     *   optionIndex: number,
     *   optionId: string,
     *   optionText: string,
     *   question: string,
     *   prompt: string,
     *   value: any
     * }
     */
    case "INSIGHT_OPTION_SELECTED": {
      const optionIndex = Number.isFinite(Number(payload?.optionIndex))
        ? Number(payload.optionIndex)
        : null;

      const optionId = payload?.optionId ?? null;
      const optionText = payload?.optionText ?? payload?.text ?? null;

      const question =
        payload?.question ??
        payload?.prompt ??
        session?.node?.question ??
        session?.node?.prompt ??
        null;

      const value = payload?.value ?? null;

      let next = {
        ...session,
        insight: {
          optionIndex,
          optionId,
          optionText,
          value,
          question,
          levelId: payload?.levelId ?? session.levelId ?? null,
          gameId: payload?.gameId ?? session.gameId ?? null,
          nodeIndex: payload?.nodeIndex ?? session.nodeIndex ?? null,
          levelIndex: payload?.levelIndex ?? session.levelIndex ?? null,
          at: payload?.at ?? Date.now(),
        },
      };

      next = emitTelemetry(next, {
        type: "INSIGHT_OPTION_SELECTED",
        at: next.time.now,
        nodeIndex: next.nodeIndex,
        stateType: nodeType(currentNode(next)),
        selectedValue: value ?? optionId ?? optionIndex,
        selectedLabel: optionText,
        optionIndex,
        optionId,
        optionText,
        value,
        question,
      });

      return next;
    }

    /* ---------------------- Pose match scoring (no telemetry) ---------------------- */

    case "POSE_MATCH_SCORES": {
      const overall = Number(payload?.overall ?? 0);
      const perSegment = Array.isArray(payload?.perSegment) ? payload.perSegment : [];
      const thresholdPct = Number(payload?.thresholdPct ?? 70);
      const targetPoseId = payload?.targetPoseId ?? null;
      const stepIndex = Number.isFinite(Number(payload?.stepIndex))
        ? Number(payload.stepIndex)
        : null;

      const matched = overall >= thresholdPct;

      return {
        ...session,
        poseMatch: {
          overall,
          perSegment,
          thresholdPct,
          matched,
          targetPoseId,
          stepIndex,
          updatedAt: session.time.now,
        },
      };
    }

    case "NEXT":
      return handleNext(session, payload);

    case "RESTART_LEVEL":
      return createInitialSession({
        game: session.game,
        initialLevel: session.levelIndex,
        playId: session.playId,
      });

    default:
      return session;
  }
}

/* ----------------------------- node handling ----------------------------- */

function currentNode(session) {
  return session.levelStateNodes?.[session.nodeIndex] ?? null;
}

function cancelNodeTimers(session, nodeIndex) {
  let s = session;
  s = cancelTimersByTag(s, "cursorDelay");
  s = cancelTimersByTag(s, `auto:${nodeIndex}`);
  s = cancelTimersByTag(s, `tween:${nodeIndex}:replay`);
  s = cancelTimersByTag(s, `tween:${nodeIndex}:finish`);
  return s;
}

function enterNode(session, nodeIndex, { reason } = {}) {
  const node = session.levelStateNodes?.[nodeIndex] ?? null;
  console.log("POSE NODE", node?.type, node?.poseIds?.length, node?.poseTolerances);

  const t = nodeType(node);

  let next = {
    ...session,
    nodeIndex,
    node,
    flags: { ...session.flags, showCursor: false },
  };

  next = cancelNodeTimers(next, nodeIndex);

  if (isDialogueLikeType(t)) next = { ...next, dialogueIndex: 0 };
  if (isSteppedPoseType(t)) next = { ...next, stepIndex: 0 };

  // ✅ IMPORTANT: initialize poseMatch using node poseIds + node.poseTolerances[0]
  if (t === STATE_TYPES.POSE_MATCH) {
    const poseIds = Array.isArray(node?.poseIds) ? node.poseIds : [];
    const initialStep = 0;
    const initialTargetPoseId = poseIds[initialStep] ?? null;
    const initialThresholdPct = getPoseThresholdPctForStep(node, initialStep, 70);

    next = {
      ...next,
      poseMatch: {
        overall: 0,
        perSegment: [],
        thresholdPct: initialThresholdPct,
        matched: false,
        targetPoseId: initialTargetPoseId,
        stepIndex: initialStep,
        updatedAt: next.time.now,
      },
    };
  }

  if (t === STATE_TYPES.TWEEN) next = { ...next, tweenPlayIndex: 0 };

  next = emitTelemetry(next, {
    type: "STATE_ENTER",
    at: session.time.now,
    nodeIndex,
    stateType: t,
    reason: reason ?? "UNKNOWN",
  });

  next = pushEffect(next, {
    type: "POSE_RECORDING_HINT",
    enabled:
      t === STATE_TYPES.POSE_MATCH ||
      t === STATE_TYPES.INSIGHT ||
      t === STATE_TYPES.INTUITION,
    stateType: t,
    nodeIndex,
  });

  next = scheduleCursor(next);
  next = scheduleAutoAdvanceIfNeeded(next);

  return next;
}

function exitNode(session, { reason } = {}) {
  const node = currentNode(session);
  const t = nodeType(node);

  return emitTelemetry(session, {
    type: "STATE_EXIT",
    at: session.time.now,
    nodeIndex: session.nodeIndex,
    stateType: t,
    reason: reason ?? "UNKNOWN",
  });
}

function goNextNode(session, { reason } = {}) {
  const nextIndex = session.nodeIndex + 1;

  if (nextIndex >= (session.levelStateNodes?.length ?? 0)) {
    let done = exitNode(session, { reason: reason ?? "LEVEL_COMPLETE" });

    // keep if you want (you can filter it out in the emitter)
    done = emitTelemetry(done, {
      type: "LEVEL_COMPLETE",
      at: done.time.now,
      levelId: done.levelId,
    });

    // Add a session end marker here (safe + deterministic)
    done = emitTelemetry(done, {
      type: "SESSION_END",
      at: done.time.now,
      levelId: done.levelId,
      gameId: done.gameId,
      playId: done.playId,
    });

    return pushEffect(done, { type: "ON_COMPLETE" });
  }

  let next = exitNode(session, { reason: reason ?? "NEXT_NODE" });
  next = enterNode(next, nextIndex, { reason: reason ?? "NEXT_NODE" });
  return next;
}

/* ----------------------------- NEXT logic ----------------------------- */

function handleNext(session, payload) {
  const node = currentNode(session);
  const t = nodeType(node);

  const source = payload?.source ?? "unknown"; // "click" | "auto"
  const isManualClick = source === "click";

  // Dialogue stepping
  if (isDialogueLikeType(t)) {
    const lines = node?.lines ?? node?.dialogues ?? [];
    const nextDialogueIndex = (session.dialogueIndex ?? 0) + 1;

    if (Array.isArray(lines) && lines.length > 0) {
      let s = cancelNodeTimers(session, session.nodeIndex);

      if (nextDialogueIndex < lines.length) {
        s = {
          ...s,
          dialogueIndex: nextDialogueIndex,
          flags: { ...s.flags, showCursor: false },
        };

        s = emitTelemetry(s, {
          type: "DIALOGUE_NEXT",
          at: s.time.now,
          nodeIndex: s.nodeIndex,
          stateType: t,
          dialogueIndex: nextDialogueIndex,
        });

        s = scheduleCursor(s);
        s = scheduleAutoAdvanceIfNeeded(s);
        return s;
      }

      let s2 = emitTelemetry(session, {
        type: "DIALOGUE_END",
        at: session.time.now,
        nodeIndex: session.nodeIndex,
        stateType: t,
      });

      s2 = cancelNodeTimers(s2, session.nodeIndex);
      return goNextNode(s2, { reason: "DIALOGUE_FINISHED" });
    }

    return goNextNode(session, { reason: "NO_DIALOGUE_LINES" });
  }

  // TWEEN: Next ends early
  if (t === STATE_TYPES.TWEEN) {
    let s = cancelNodeTimers(session, session.nodeIndex);

    s = emitTelemetry(s, {
      type: "TWEEN_SKIP",
      at: s.time.now,
      nodeIndex: s.nodeIndex,
      stateType: t,
      playIndex: s.tweenPlayIndex ?? 0,
    });

    return goNextNode(s, { reason: "TWEEN_SKIPPED" });
  }

  // POSE_MATCH:
  // ✅ manual click ALWAYS advances
  // ✅ auto only advances if matched
  if (t === STATE_TYPES.POSE_MATCH) {
    const poseIds = Array.isArray(node?.poseIds) ? node.poseIds : [];
    const i = session.stepIndex ?? 0;

    if (poseIds.length <= 0) return goNextNode(session, { reason: "POSE_MATCH_EMPTY" });

    const matched = !!session.poseMatch?.matched;

    if (!isManualClick && !matched) {
      return session;
    }

    if (i + 1 < poseIds.length) {
      const nextStep = i + 1;
      const nextTargetPoseId = poseIds[nextStep] ?? null;

      // ✅ IMPORTANT: update thresholdPct for the NEXT step from node.poseTolerances[nextStep]
      const nextThresholdPct = getPoseThresholdPctForStep(node, nextStep, 70);

      let s = {
        ...session,
        stepIndex: nextStep,
        flags: { ...session.flags, showCursor: false },
        poseMatch: {
          ...(session.poseMatch ?? {}),
          overall: 0,
          perSegment: [],
          matched: false,
          targetPoseId: nextTargetPoseId,
          thresholdPct: nextThresholdPct, // ✅ FIX
          stepIndex: nextStep,
          updatedAt: session.time.now,
        },
      };

      s = emitTelemetry(s, {
        type: isManualClick ? "POSE_MATCH_CLICK_NEXT" : "POSE_MATCH_AUTO_NEXT",
        at: s.time.now,
        nodeIndex: s.nodeIndex,
        stateType: t,
        stepIndex: s.stepIndex,
        targetPoseId: nextTargetPoseId,
        thresholdPct: nextThresholdPct,
      });

      s = scheduleCursor(s);
      return s;
    }

    return goNextNode(session, {
      reason: isManualClick ? "POSE_MATCH_CLICK_FINISH" : "POSE_MATCH_AUTO_FINISH",
    });
  }

  return goNextNode(session, { reason: "NEXT_COMMAND" });
}

/* ----------------------------- timers ----------------------------- */

function applyTimer(session, timer) {
  switch (timer.kind) {
    case "SHOW_CURSOR": {
      const next = { ...session, flags: { ...session.flags, showCursor: true } };
      return emitTelemetry(next, {
        type: "CURSOR_SHOWN",
        at: session.time.now,
        nodeIndex: session.nodeIndex,
      });
    }

    case "AUTO_NEXT":
      return handleNext(session, { source: "auto" });

    case "AUTO_ADVANCE":
      return goNextNode(session, { reason: "AUTO_ADVANCE" });

    case "TWEEN_REPLAY": {
      const nextPlayIndex = (session.tweenPlayIndex ?? 0) + 1;
      const next = { ...session, tweenPlayIndex: nextPlayIndex };

      return emitTelemetry(next, {
        type: "TWEEN_REPLAY",
        at: next.time.now,
        nodeIndex: next.nodeIndex,
        playIndex: nextPlayIndex,
      });
    }

    default:
      return session;
  }
}

/* ----------------------------- cursor scheduling ----------------------------- */

function scheduleCursor(session) {
  const node = currentNode(session);
  if (!node) return session;

  const delayMS = node?.cursorDelayMS ?? session.settings?.cursor?.delayMS ?? 0;
  const next = cancelTimersByTag(session, "cursorDelay");

  if (!delayMS || delayMS <= 0) {
    return { ...next, flags: { ...next.flags, showCursor: true } };
  }

  return scheduleIn(next, {
    tag: "cursorDelay",
    kind: "SHOW_CURSOR",
    delayMS,
  });
}

/* ----------------------------- auto scheduling ----------------------------- */

function scheduleAutoAdvanceIfNeeded(session) {
  const node = currentNode(session);
  if (!node) return session;

  const t = nodeType(node);

  const tag = `auto:${session.nodeIndex}`;
  if ((session.timers ?? []).some((tm) => tm.tag === tag)) return session;

  const autoMS = node?.autoAdvanceMS ?? node?.durationMS ?? 0;
  if (!autoMS || autoMS <= 0) return session;

  if (isDialogueLikeType(t)) {
    return scheduleIn(session, { tag, kind: "AUTO_NEXT", delayMS: autoMS });
  }

  return scheduleIn(session, { tag, kind: "AUTO_ADVANCE", delayMS: autoMS });
}

/* ----------------------------- settings util ----------------------------- */

function setByPath(obj, path, value) {
  const parts = String(path).split(".").filter(Boolean);
  if (!parts.length) return obj;

  const root = { ...(obj ?? {}) };
  let cur = root;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    cur[key] = { ...(cur[key] ?? {}) };
    cur = cur[key];
  }

  cur[parts[parts.length - 1]] = value;
  return root;
}
