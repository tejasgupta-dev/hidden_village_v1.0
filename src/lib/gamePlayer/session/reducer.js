"use client";

import { createSession } from "./createSession";
import { scheduleIn, cancelTimersByTag, runDueTimers } from "./timers";
import { STATE_TYPES, normalizeStateType } from "../states/_shared/stateTypes";

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
  return t === STATE_TYPES.TWEEN || t === STATE_TYPES.POSE_MATCH;
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

  const parts = [baseEventId(session), t, `n${ni}`, `s${st}`];
  if (di != null) parts.push(`d${di}`);
  if (si != null) parts.push(`k${si}`);

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

      let next = {
        ...session,
        time: { ...session.time, now, dt, elapsed },
      };

      next = runDueTimers(next, applyTimer);
      next = maybeScheduleAutoAdvance(next);

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

      next = scheduleCursorIfDialogueLike(next);
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

    case "NEXT":
      return handleNext(session);

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

/* ----------------------------- Node handling ----------------------------- */

function currentNode(session) {
  return session.levelStateNodes?.[session.nodeIndex] ?? null;
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

  // Cancel node-scoped timers
  next = cancelTimersByTag(next, "cursorDelay");
  next = cancelTimersByTag(next, `auto:${nodeIndex}`);

  if (isDialogueLikeType(t)) next = { ...next, dialogueIndex: 0 };
  if (isSteppedPoseType(t)) next = { ...next, stepIndex: 0 };

  next = emitTelemetry(next, {
    type: "STATE_ENTER",
    at: session.time.now,
    nodeIndex,
    stateType: t,
    reason: reason ?? "UNKNOWN",
  });

  // Pose recording hint effect (not telemetry)
  next = pushEffect(next, {
    type: "POSE_RECORDING_HINT",
    enabled:
      t === STATE_TYPES.POSE_MATCH ||
      t === STATE_TYPES.INSIGHT ||
      t === STATE_TYPES.INTUITION,
    stateType: t,
    nodeIndex,
  });

  next = scheduleCursorIfDialogueLike(next);
  next = maybeScheduleAutoAdvance(next);

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

function handleNext(session) {
  const node = currentNode(session);
  const t = nodeType(node);

  // Dialogue stepping (intro/outro)
  if (isDialogueLikeType(t)) {
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

        s = emitTelemetry(s, {
          type: "DIALOGUE_NEXT",
          at: s.time.now,
          nodeIndex: s.nodeIndex,
          stateType: t,
          dialogueIndex: nextDialogueIndex,
        });

        s = scheduleCursorIfDialogueLike(s);
        s = maybeScheduleAutoAdvance(s);
        return s;
      }

      let s2 = emitTelemetry(session, {
        type: "DIALOGUE_END",
        at: session.time.now,
        nodeIndex: session.nodeIndex,
        stateType: t,
      });

      s2 = cancelTimersByTag(s2, "cursorDelay");
      s2 = cancelTimersByTag(s2, `auto:${session.nodeIndex}`);

      return goNextNode(s2, { reason: "DIALOGUE_FINISHED" });
    }

    return goNextNode(session, { reason: "NO_DIALOGUE_LINES" });
  }

  // Tween steps
  if (t === STATE_TYPES.TWEEN) {
    const poseIds = Array.isArray(node?.poseIds) ? node.poseIds : [];
    const transitions = Math.max(0, poseIds.length - 1);
    const i = session.stepIndex ?? 0;

    if (transitions <= 0) return goNextNode(session, { reason: "TWEEN_EMPTY" });

    if (i + 1 < transitions) {
      const s = { ...session, stepIndex: i + 1 };
      return emitTelemetry(s, {
        type: "TWEEN_STEP",
        at: s.time.now,
        nodeIndex: s.nodeIndex,
        stateType: t,
        stepIndex: s.stepIndex,
        fromPoseId: poseIds[s.stepIndex],
        toPoseId: poseIds[s.stepIndex + 1],
      });
    }

    return goNextNode(session, { reason: "TWEEN_FINISHED" });
  }

  // Pose match steps
  if (t === STATE_TYPES.POSE_MATCH) {
    const poseIds = Array.isArray(node?.poseIds) ? node.poseIds : [];
    const i = session.stepIndex ?? 0;

    if (poseIds.length <= 0) return goNextNode(session, { reason: "POSE_MATCH_EMPTY" });

    if (i + 1 < poseIds.length) {
      const s = { ...session, stepIndex: i + 1 };
      return emitTelemetry(s, {
        type: "POSE_MATCH_NEXT_TARGET",
        at: s.time.now,
        nodeIndex: s.nodeIndex,
        stateType: t,
        stepIndex: s.stepIndex,
        targetPoseId: poseIds[s.stepIndex],
      });
    }

    return goNextNode(session, { reason: "POSE_MATCH_FINISHED" });
  }

  return goNextNode(session, { reason: "NEXT_COMMAND" });
}

/* ----------------------------- Timers ----------------------------- */

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
      return handleNext(session);

    case "AUTO_ADVANCE":
      return goNextNode(session, { reason: "AUTO_ADVANCE" });

    default:
      return session;
  }
}

function scheduleCursorIfDialogueLike(session) {
  const node = currentNode(session);
  const t = nodeType(node);
  if (!isDialogueLikeType(t)) return session;

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

function maybeScheduleAutoAdvance(session) {
  const node = currentNode(session);
  if (!node) return session;

  const autoMS = node?.autoAdvanceMS ?? node?.durationMS;
  if (!autoMS) return session;

  const tag = `auto:${session.nodeIndex}`;
  if ((session.timers ?? []).some((t) => t.tag === tag)) return session;

  const t = nodeType(node);

  if (isDialogueLikeType(t)) {
    return scheduleIn(session, {
      tag,
      kind: "AUTO_NEXT",
      delayMS: autoMS,
    });
  }

  return scheduleIn(session, {
    tag,
    kind: "AUTO_ADVANCE",
    delayMS: autoMS,
  });
}

/* ----------------------------- Settings util ----------------------------- */

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
