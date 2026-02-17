/**
 * Tick-driven timer utilities.
 *
 * Timers are stored in session.timers as:
 *
 * {
 *   id: string,
 *   tag?: string,          // optional grouping tag
 *   kind: string,          // semantic meaning (SHOW_CURSOR, AUTO_ADVANCE, etc.)
 *   at: number,            // absolute time in ms when it should fire
 *   payload?: any
 * }
 *
 * Timers are evaluated inside reducer during TICK.
 */

/* ---------------------------- Scheduling ---------------------------- */

/**
 * Add a timer to the session.
 */
export function scheduleTimer(session, timer) {
  const id = timer.id ?? generateTimerId();
  const nextTimer = { ...timer, id };

  return {
    ...session,
    timers: [...(session.timers ?? []), nextTimer],
  };
}

/**
 * Remove timer by id.
 */
export function cancelTimerById(session, id) {
  return {
    ...session,
    timers: (session.timers ?? []).filter((t) => t.id !== id),
  };
}

/**
 * Remove timers by tag (useful for cursorDelay, auto:<nodeIndex>, etc.)
 */
export function cancelTimersByTag(session, tag) {
  return {
    ...session,
    timers: (session.timers ?? []).filter((t) => t.tag !== tag),
  };
}

/**
 * Remove timers by kind.
 */
export function cancelTimersByKind(session, kind) {
  return {
    ...session,
    timers: (session.timers ?? []).filter((t) => t.kind !== kind),
  };
}

/* ---------------------------- Execution ---------------------------- */

/**
 * Run timers whose time has arrived.
 *
 * @param session
 * @param applyTimerFn (session, timer) => session
 */
export function runDueTimers(session, applyTimerFn) {
  const now = session.time?.now;
  if (!now || !session.timers?.length) return session;

  const due = [];
  const pending = [];

  for (const timer of session.timers) {
    if (timer.at <= now) due.push(timer);
    else pending.push(timer);
  }

  let next = {
    ...session,
    timers: pending,
  };

  for (const timer of due) {
    next = applyTimerFn(next, timer);
  }

  return next;
}

/* ---------------------------- Helpers ---------------------------- */

/**
 * Schedule a relative timer (ms from now)
 */
export function scheduleIn(session, { delayMS, kind, tag, payload }) {
  const now = session.time?.now ?? Date.now();
  return scheduleTimer(session, {
    kind,
    tag,
    payload,
    at: now + delayMS,
  });
}

/**
 * Generate unique-ish timer ids
 */
function generateTimerId() {
  return `timer_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}
