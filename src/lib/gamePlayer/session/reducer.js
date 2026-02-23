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
  const arr = Array.isArray(node?.poseTolerances) ? node.poseTolerances : null;
  const fromArray =
    arr && stepIndex >= 0 && stepIndex < arr.length ? arr[stepIndex] : undefined;
  if (fromArray !== undefined && fromArray !== null && fromArray !== "") {
    return clampPct(fromArray, fallback);
  }

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

  // ✅ Use repIndex (preferred) or fallback to playIndex (legacy)
  const ri = evt?.repIndex ?? evt?.playIndex;

  const parts = [baseEventId(session), t, `n${ni}`, `s${st}`];
  if (di != null) parts.push(`d${di}`);
  if (si != null) parts.push(`k${si}`);
  if (ri != null) parts.push(`r${ri}`);

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
  let session = createSession({
    game,
    playId,
    initialLevel,
    initialNodeIndex: 0,
  });

  // Session boundary
  session = emitTelemetry(session, {
    type: "SESSION_START",
    at: session.time.now,
    gameId: session.gameId,
    playId: session.playId,
  });

  // ✅ Level boundary (ALWAYS)
  session = emitTelemetry(session, {
    type: "LEVEL_START",
    at: session.time.now,
    gameId: session.gameId,
    playId: session.playId,
    levelId: session.levelId,
    levelIndex: session.levelIndex,
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

      return emitTelemetry(next, {
        type: "PAUSE",
        at: next.time.now,
        gameId: next.gameId,
        playId: next.playId,
        levelId: next.levelId,
        levelIndex: next.levelIndex,
        nodeIndex: next.nodeIndex,
        stateType: nodeType(currentNode(next)),
      });
    }

    case "RESUME": {
      if (!session.flags.paused) return session;

      let next = {
        ...session,
        flags: { ...session.flags, paused: false, showPauseMenu: false },
      };

      next = emitTelemetry(next, {
        type: "RESUME",
        at: next.time.now,
        gameId: next.gameId,
        playId: next.playId,
        levelId: next.levelId,
        levelIndex: next.levelIndex,
        nodeIndex: next.nodeIndex,
        stateType: nodeType(currentNode(next)),
      });

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
        at: next.time.now,
        gameId: next.gameId,
        playId: next.playId,
        levelId: next.levelId,
        levelIndex: next.levelIndex,
        nodeIndex: next.nodeIndex,
        stateType: nodeType(currentNode(next)),
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
          levelId: session.levelId ?? null,
          gameId: session.gameId ?? null,
          nodeIndex: session.nodeIndex ?? null,
          levelIndex: session.levelIndex ?? null,
          at: payload?.at ?? Date.now(),
        },
      };

      next = emitTelemetry(next, {
        type: "TRUE_FALSE_SELECTED",
        at: next.time.now,

        // ✅ separation keys
        gameId: next.gameId,
        playId: next.playId,
        levelId: next.levelId,
        levelIndex: next.levelIndex,
        repIndex: 0,

        nodeIndex: next.nodeIndex,
        stateType: nodeType(currentNode(next)),

        selectedValue: answer,
        selectedLabel: answer === true ? "True" : answer === false ? "False" : null,

        answer,
        question: next.intuition?.question,
      });

      return next;
    }

    /* ---------------------- Insight (option choice) ---------------------- */

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
          levelId: session.levelId ?? null,
          gameId: session.gameId ?? null,
          nodeIndex: session.nodeIndex ?? null,
          levelIndex: session.levelIndex ?? null,
          at: payload?.at ?? Date.now(),
        },
      };

      next = emitTelemetry(next, {
        type: "INSIGHT_OPTION_SELECTED",
        at: next.time.now,

        // ✅ separation keys
        gameId: next.gameId,
        playId: next.playId,
        levelId: next.levelId,
        levelIndex: next.levelIndex,
        repIndex: 0,

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
      return restartCurrentLevel(session);

    default:
      return session;
  }
}

/* ----------------------------- node handling ----------------------------- */

function currentNode(session) {
  return session?.nodes?.[session?.nodeIndex] ?? null;
}

function cursorTag(nodeIndex) {
  return `cursorDelay:${nodeIndex}`;
}

function cancelNodeTimers(session, nodeIndex) {
  let s = session;
  s = cancelTimersByTag(s, cursorTag(nodeIndex));
  s = cancelTimersByTag(s, `auto:${nodeIndex}`);
  s = cancelTimersByTag(s, `tween:${nodeIndex}:replay`);
  s = cancelTimersByTag(s, `tween:${nodeIndex}:finish`);
  return s;
}

function enterNode(session, nodeIndex, { reason } = {}) {
  const node = session.nodes?.[nodeIndex] ?? null;
  const t = nodeType(node);

  let next = cancelNodeTimers(session, nodeIndex);

  next = {
    ...next,
    nodeIndex,
    node,
    flags: { ...next.flags, showCursor: false },
  };

  if (isDialogueLikeType(t)) next = { ...next, dialogueIndex: 0 };
  if (isSteppedPoseType(t)) next = { ...next, stepIndex: 0 };

  if (t === STATE_TYPES.POSE_MATCH) {
    const poseIds = Array.isArray(node?.poseIds) ? node.poseIds : [];
    const initialStep = 0;
    const initialTargetPoseId = poseIds[initialStep] ?? null;
    const initialThresholdPct = getPoseThresholdPctForStep(node, initialStep, 70);

    next = {
      ...next,
      poseMatchRoundIndex: 0,
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
  } else {
    next = { ...next, poseMatch: null, poseMatchRoundIndex: 0 };
  }

  if (t === STATE_TYPES.TWEEN) next = { ...next, tweenPlayIndex: 0 };

  next = emitTelemetry(next, {
    type: "STATE_ENTER",
    at: next.time.now,

    gameId: next.gameId,
    playId: next.playId,
    levelId: next.levelId,
    levelIndex: next.levelIndex,

    // ✅ include repIndex for pose match states
    repIndex: t === STATE_TYPES.POSE_MATCH ? (next.poseMatchRoundIndex ?? 0) : 0,

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

  let s = cancelNodeTimers(session, session.nodeIndex);

  return emitTelemetry(s, {
    type: "STATE_EXIT",
    at: s.time.now,

    gameId: s.gameId,
    playId: s.playId,
    levelId: s.levelId,
    levelIndex: s.levelIndex,

    // ✅ include repIndex for pose match states
    repIndex: t === STATE_TYPES.POSE_MATCH ? (s.poseMatchRoundIndex ?? 0) : 0,

    nodeIndex: s.nodeIndex,
    stateType: t,
    reason: reason ?? "UNKNOWN",
  });
}

/* ----------------------------- level transitions ----------------------------- */

function restartCurrentLevel(session) {
  // exit current node so we never miss STATE_EXIT (including OUTRO)
  let s = exitNode(session, { reason: "RESTART_LEVEL" });

  // level end boundary for the current run of the level
  s = emitTelemetry(s, {
    type: "LEVEL_END",
    at: s.time.now,
    gameId: s.gameId,
    playId: s.playId,
    levelId: s.levelId,
    levelIndex: s.levelIndex,
    reason: "RESTART_LEVEL",
  });

  const prevStartedAt =
    s?.time?.startedAt ?? (typeof performance !== "undefined" ? performance.now() : Date.now());

  let next = createSession({
    game: s.game,
    playId: s.playId,
    initialLevel: s.levelIndex ?? 0,
    initialNodeIndex: 0,
  });

  next = {
    ...next,
    time: {
      ...next.time,
      startedAt: prevStartedAt,
      now: s.time.now,
      elapsed: s.time.elapsed,
      dt: 0,
    },
    timers: [],
    effects: [],
    flags: { ...next.flags, paused: false, showPauseMenu: false, showCursor: false },
    poseMatch: null,
    poseMatchRoundIndex: 0,
    tweenPlayIndex: 0,
  };

  next = emitTelemetry(next, {
    type: "LEVEL_START",
    at: next.time.now,
    gameId: next.gameId,
    playId: next.playId,
    levelId: next.levelId,
    levelIndex: next.levelIndex,
    reason: "RESTART_LEVEL",
  });

  next = enterNode(next, 0, { reason: "RESTART_LEVEL" });
  return next;
}

/**
 * When a level finishes:
 * - always emit LEVEL_END
 * - either advance to next level (emit LEVEL_START) or end session (SESSION_END + ON_COMPLETE)
 */
function advanceToNextLevelOrFinish(session, { reason } = {}) {
  const gameLevels = Array.isArray(session?.game?.levels) ? session.game.levels : [];
  const nextLevelIndex = (session.levelIndex ?? 0) + 1;

  // ✅ ALWAYS: level end boundary
  let s = emitTelemetry(session, {
    type: "LEVEL_END",
    at: session.time.now,
    gameId: session.gameId,
    playId: session.playId,
    levelId: session.levelId,
    levelIndex: session.levelIndex,
    reason: reason ?? "LEVEL_END",
  });

  // no next level => session ends and we go back to menu
  if (nextLevelIndex >= gameLevels.length) {
    s = emitTelemetry(s, {
      type: "SESSION_END",
      at: s.time.now,
      gameId: s.gameId,
      playId: s.playId,
      levelId: s.levelId,
      levelIndex: s.levelIndex,
      reason: reason ?? "GAME_COMPLETE",
    });

    return pushEffect(s, { type: "ON_COMPLETE" });
  }

  const prevStartedAt =
    s?.time?.startedAt ?? (typeof performance !== "undefined" ? performance.now() : Date.now());

  let next = createSession({
    game: s.game,
    playId: s.playId,
    initialLevel: nextLevelIndex,
    initialNodeIndex: 0,
  });

  next = {
    ...next,
    time: {
      ...next.time,
      startedAt: prevStartedAt,
      now: s.time.now,
      elapsed: s.time.elapsed,
      dt: 0,
    },
    timers: [],
    effects: [],
    flags: { ...next.flags, paused: false, showPauseMenu: false, showCursor: false },
    poseMatch: null,
    poseMatchRoundIndex: 0,
    tweenPlayIndex: 0,
  };

  // ✅ ALWAYS: level start boundary
  next = emitTelemetry(next, {
    type: "LEVEL_START",
    at: next.time.now,
    gameId: next.gameId,
    playId: next.playId,
    levelId: next.levelId,
    levelIndex: next.levelIndex,
    reason: "NEXT_LEVEL",
  });

  next = enterNode(next, 0, { reason: "NEXT_LEVEL" });
  return next;
}

function goNextNode(session, { reason } = {}) {
  const nextIndex = session.nodeIndex + 1;

  // End of node list => end level
  if (nextIndex >= (session.nodes?.length ?? 0)) {
    // ✅ critical fix: ALWAYS exit current node first (fixes missing OUTRO exit)
    let s = exitNode(session, { reason: reason ?? "LEVEL_COMPLETE" });
    return advanceToNextLevelOrFinish(s, { reason: reason ?? "LEVEL_COMPLETE" });
  }

  let next = exitNode(session, { reason: reason ?? "NEXT_NODE" });
  next = enterNode(next, nextIndex, { reason: reason ?? "NEXT_NODE" });
  return next;
}

/* ----------------------------- NEXT logic ----------------------------- */

function handleNext(session, payload) {
  const node = currentNode(session);
  const t = nodeType(node);

  const source = payload?.source ?? "unknown";
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

          gameId: s.gameId,
          playId: s.playId,
          levelId: s.levelId,
          levelIndex: s.levelIndex,

          nodeIndex: s.nodeIndex,
          stateType: t,
          dialogueIndex: nextDialogueIndex,
        });

        s = scheduleCursor(s);
        s = scheduleAutoAdvanceIfNeeded(s);
        return s;
      }

      let s2 = emitTelemetry(s, {
        type: "DIALOGUE_END",
        at: s.time.now,

        gameId: s.gameId,
        playId: s.playId,
        levelId: s.levelId,
        levelIndex: s.levelIndex,

        nodeIndex: s.nodeIndex,
        stateType: t,
      });

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

      gameId: s.gameId,
      playId: s.playId,
      levelId: s.levelId,
      levelIndex: s.levelIndex,

      nodeIndex: s.nodeIndex,
      stateType: t,
      playIndex: s.tweenPlayIndex ?? 0,
    });

    return goNextNode(s, { reason: "TWEEN_SKIPPED" });
  }

  // POSE_MATCH
  if (t === STATE_TYPES.POSE_MATCH) {
    const poseIds = Array.isArray(node?.poseIds) ? node.poseIds : [];
    const i = session.stepIndex ?? 0;

    if (poseIds.length <= 0) return goNextNode(session, { reason: "POSE_MATCH_EMPTY" });

    const matched = !!session.poseMatch?.matched;
    if (!isManualClick && !matched) return session;

    // reps support
    const repsRaw = session?.settings?.reps?.poseMatch ?? 1;
    const reps = Number.isFinite(Number(repsRaw)) ? Math.max(1, Math.trunc(Number(repsRaw))) : 1;
    const round = Number.isFinite(Number(session?.poseMatchRoundIndex))
      ? Math.max(0, Math.trunc(Number(session.poseMatchRoundIndex)))
      : 0;

    const advanceToStep = (s, nextStep, nextRound) => {
      const nextTargetPoseId = poseIds[nextStep] ?? null;
      const nextThresholdPct = getPoseThresholdPctForStep(node, nextStep, 70);

      let out = {
        ...s,
        stepIndex: nextStep,
        poseMatchRoundIndex: nextRound,
        flags: { ...s.flags, showCursor: false },
        poseMatch: {
          ...(s.poseMatch ?? {}),
          overall: 0,
          perSegment: [],
          matched: false,
          targetPoseId: nextTargetPoseId,
          thresholdPct: nextThresholdPct,
          stepIndex: nextStep,
          updatedAt: s.time.now,
        },
      };

      out = emitTelemetry(out, {
        type: isManualClick ? "POSE_MATCH_CLICK_NEXT" : "POSE_MATCH_AUTO_NEXT",
        at: out.time.now,

        gameId: out.gameId,
        playId: out.playId,
        levelId: out.levelId,
        levelIndex: out.levelIndex,
        repIndex: nextRound,

        nodeIndex: out.nodeIndex,
        stateType: t,
        stepIndex: nextStep,
        targetPoseId: nextTargetPoseId,
        thresholdPct: nextThresholdPct,
      });

      out = scheduleCursor(out);
      out = scheduleAutoAdvanceIfNeeded(out);
      return out;
    };

    // next pose in current round
    if (i + 1 < poseIds.length) {
      let s = cancelNodeTimers(session, session.nodeIndex);
      return advanceToStep(s, i + 1, round);
    }

    // finished last pose in sequence; loop for next round if needed
    if (round + 1 < reps) {
      let s = cancelNodeTimers(session, session.nodeIndex);

      s = emitTelemetry(s, {
        type: isManualClick ? "POSE_MATCH_REP_FINISH_CLICK" : "POSE_MATCH_REP_FINISH_AUTO",
        at: s.time.now,

        gameId: s.gameId,
        playId: s.playId,
        levelId: s.levelId,
        levelIndex: s.levelIndex,
        repIndex: round,

        nodeIndex: s.nodeIndex,
        stateType: t,
        stepIndex: i,
      });

      return advanceToStep(s, 0, round + 1);
    }

    // finished final round
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
        at: next.time.now,
        gameId: next.gameId,
        playId: next.playId,
        levelId: next.levelId,
        levelIndex: next.levelIndex,
        nodeIndex: next.nodeIndex,
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
        gameId: next.gameId,
        playId: next.playId,
        levelId: next.levelId,
        levelIndex: next.levelIndex,
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

  let next = cancelTimersByTag(session, cursorTag(session.nodeIndex));

  if (!delayMS || delayMS <= 0) {
    return { ...next, flags: { ...next.flags, showCursor: true } };
  }

  return scheduleIn(next, {
    tag: cursorTag(session.nodeIndex),
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