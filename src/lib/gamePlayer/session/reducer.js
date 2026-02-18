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
  return t === STATE_TYPES.DIALOGUE || t === STATE_TYPES.INTRO || t === STATE_TYPES.OUTRO;
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

      // Re-schedule cursor delay if we resumed in a dialogue-like node
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

  // Cancel node-scoped timers
  next = cancelTimersByTag(next, "cursorDelay");
  next = cancelTimersByTag(next, `auto:${nodeIndex}`);

  // Reset dialogueIndex whenever we enter a dialogue-like node
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

  // Let the root know whether we should record pose frames in this node
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
    // exit current node for consistent telemetry
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


function handleNext(session) {
  const node = currentNode(session);
  const t = nodeType(node);

  // Intro / Dialogue / Outro all behave the same for dialogue advancement
  if (isDialogueLikeType(t)) {
    const lines = node?.lines ?? node?.dialogues ?? [];
    const nextDialogueIndex = (session.dialogueIndex ?? 0) + 1;

    // If there are lines, step through them
    if (Array.isArray(lines) && lines.length > 0) {
      // ✅ cancel any pending auto-next for this node when user advances manually
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

        // Re-schedule cursor delay + re-schedule auto-next for the next line
        next = scheduleCursorIfDialogueLike(next);
        next = maybeScheduleAutoAdvance(next);
        return next;
      }

      // end of lines -> next node
      next = pushEffect(next, {
        type: "TELEMETRY_EVENT",
        event: {
          type: "DIALOGUE_END",
          at: next.time.now,
          nodeIndex: next.nodeIndex,
          stateType: t,
        },
      });

      // ✅ prevent any leftover timers from firing after node exit
      next = cancelTimersByTag(next, "cursorDelay");
      next = cancelTimersByTag(next, `auto:${next.nodeIndex}`);

      return goNextNode(next, { reason: "DIALOGUE_FINISHED" });
    }

    // If no lines provided, treat NEXT as node advance
    return goNextNode(session, { reason: "NO_DIALOGUE_LINES" });
  }

  // Non-dialogue nodes: NEXT advances to next node
  return goNextNode(session, { reason: "NEXT_COMMAND" });
}

/* ----------------------------- Timers ----------------------------- */

function applyTimer(session, timer) {
  switch (timer.kind) {
    case "SHOW_CURSOR": {
      let next = { ...session, flags: { ...session.flags, showCursor: true } };
      return pushEffect(next, {
        type: "TELEMETRY_EVENT",
        event: { type: "CURSOR_SHOWN", at: session.time.now, nodeIndex: session.nodeIndex },
      });
    }

    // ✅ Dialogue-like nodes auto-advance by running the same logic as clicking Next
    case "AUTO_NEXT":
      return handleNext(session);

    // ✅ Non-dialogue nodes auto-advance to the next node
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

  const delayMS =
    node?.cursorDelayMS ??
    session.settings?.cursor?.delayMS ??
    0;

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

  // don't double-schedule
  if ((session.timers ?? []).some((t) => t.tag === tag)) {
    return session;
  }

  const t = nodeType(node);

  // ✅ For dialogue-like nodes, "auto advance" means "Next line"
  if (isDialogueLikeType(t)) {
    return scheduleIn(session, {
      tag,
      kind: "AUTO_NEXT",
      delayMS: autoMS,
    });
  }

  // ✅ For non-dialogue nodes, "auto advance" means "Next node"
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
