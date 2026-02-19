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

    case "POSE_MATCH_SCORES": {
      const overall = Number(payload?.overall ?? 0);
      const perSegment = Array.isArray(payload?.perSegment) ? payload.perSegment : [];
      const thresholdPct = Number(payload?.thresholdPct ?? 70);
      const targetPoseId = payload?.targetPoseId ?? null;
      const stepIndex = Number.isFinite(Number(payload?.stepIndex)) ? Number(payload.stepIndex) : null;

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

  if (t === STATE_TYPES.POSE_MATCH) {
    next = {
      ...next,
      poseMatch: {
        overall: 0,
        perSegment: [],
        thresholdPct: 70,
        matched: false,
        targetPoseId: null,
        stepIndex: 0,
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

    done = emitTelemetry(done, {
      type: "LEVEL_COMPLETE",
      at: done.time.now,
      levelId: done.levelId,
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
      // auto path blocked unless matched
      return session;
    }

    if (i + 1 < poseIds.length) {
      const nextStep = i + 1;
      const nextTargetPoseId = poseIds[nextStep] ?? null;

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
          thresholdPct: session.poseMatch?.thresholdPct ?? 70,
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
      // ✅ auto-advance should not bypass match rules
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
