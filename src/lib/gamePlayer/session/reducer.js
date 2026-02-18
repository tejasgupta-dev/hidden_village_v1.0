"use client";

import { createSession } from "./createSession";
import { scheduleIn, cancelTimersByTag, runDueTimers } from "./timers";
import { STATE_TYPES, normalizeStateType } from "../states/_shared/stateTypes";
import { createNextHandler } from "./nextHandlers";

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

export function createInitialSession({ game, initialLevel = 0, playId = null }) {
  let session = createSession({
    game,
    playId,
    initialLevel,
    initialNodeIndex: 0,
  });

  session = pushEffect(session, {
    type: "TELEMETRY_EVENT",
    event: {
      type: "SESSION_START",
      at: session.time.now,
      levelId: session.levelId,
      gameId: session.gameId,
      playId: session.playId,
    },
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
      let next = {
        ...session,
        flags: { ...session.flags, paused: true, showPauseMenu: true },
      };
      return pushEffect(next, {
        type: "TELEMETRY_EVENT",
        event: { type: "PAUSE", at: session.time.now },
      });
    }

    case "RESUME": {
      if (!session.flags.paused) return session;

      let next = {
        ...session,
        flags: { ...session.flags, paused: false, showPauseMenu: false },
      };

      next = pushEffect(next, {
        type: "TELEMETRY_EVENT",
        event: { type: "RESUME", at: session.time.now },
      });

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

      next = pushEffect(next, {
        type: "TELEMETRY_EVENT",
        event: { type: "SETTING_CHANGED", at: session.time.now, path, value },
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

  next = cancelTimersByTag(next, "cursorDelay");
  next = cancelTimersByTag(next, `auto:${nodeIndex}`);

  if (isDialogueLikeType(t)) {
    next = { ...next, dialogueIndex: 0 };
  }

  next = pushEffect(next, {
    type: "TELEMETRY_EVENT",
    event: {
      type: "STATE_ENTER",
      at: session.time.now,
      nodeIndex,
      stateType: t,
      reason: reason ?? "UNKNOWN",
    },
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

  next = scheduleCursorIfDialogueLike(next);
  next = maybeScheduleAutoAdvance(next);

  return next;
}

function exitNode(session, { reason } = {}) {
  const node = currentNode(session);
  const t = nodeType(node);

  return pushEffect(session, {
    type: "TELEMETRY_EVENT",
    event: {
      type: "STATE_EXIT",
      at: session.time.now,
      nodeIndex: session.nodeIndex,
      stateType: t,
      reason: reason ?? "UNKNOWN",
    },
  });
}

function goNextNode(session, { reason } = {}) {
  const nextIndex = session.nodeIndex + 1;

  if (nextIndex >= (session.levelStateNodes?.length ?? 0)) {
    let done = exitNode(session, { reason: reason ?? "LEVEL_COMPLETE" });

    done = pushEffect(done, {
      type: "TELEMETRY_EVENT",
      event: { type: "LEVEL_COMPLETE", at: done.time.now, levelId: done.levelId },
    });

    return pushEffect(done, { type: "ON_COMPLETE" });
  }

  let next = exitNode(session, { reason: reason ?? "NEXT_NODE" });
  next = enterNode(next, nextIndex, { reason: reason ?? "NEXT_NODE" });
  return next;
}

/* ----------------------------- NEXT handler (pluggable) ----------------------------- */

const handleNext = createNextHandler({
  currentNode,
  nodeType,
  pushEffect,
  cancelTimersByTag,
  scheduleCursorIfDialogueLike,
  maybeScheduleAutoAdvance,
  goNextNode,
});

/* ----------------------------- Timers ----------------------------- */

function applyTimer(session, timer) {
  switch (timer.kind) {
    case "SHOW_CURSOR": {
      let next = { ...session, flags: { ...session.flags, showCursor: true } };
      return pushEffect(next, {
        type: "TELEMETRY_EVENT",
        event: {
          type: "CURSOR_SHOWN",
          at: session.time.now,
          nodeIndex: session.nodeIndex,
        },
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

  let next = cancelTimersByTag(session, "cursorDelay");

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
    return scheduleIn(session, { tag, kind: "AUTO_NEXT", delayMS: autoMS });
  }

  return scheduleIn(session, { tag, kind: "AUTO_ADVANCE", delayMS: autoMS });
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
