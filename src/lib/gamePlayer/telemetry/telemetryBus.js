"use client";

/**
 * Telemetry bus: buffers events + pose frames and flushes in batches.
 *
 * Features:
 * A) Separate flush locks for events vs frames (prevents one starving the other)
 * B) Monotonic frame sequence numbers (and timestamps) for detecting gaps
 * C) Flush on page hide/unload using sendBeacon (best-effort) + keepalive fallback
 * D) De-dupe events by eventId (prevents dev StrictMode double-logs + accidental double dispatch)
 *
 * Notes:
 * - Server must expose:
 *   POST {apiBase}/plays/:playId/events  { events: [...] }
 *   POST {apiBase}/plays/:playId/frames  { frames: [...] }
 * - If your API uses cookie auth, keep credentials: "include"
 */
export function createTelemetryBus({
  playId,
  flushEveryMS = 2000,
  maxEvents = 50,
  maxFrames = 60,
  apiBase = "/api",
  includeCredentials = true,
} = {}) {
  if (!playId) throw new Error("createTelemetryBus: playId is required");

  let events = [];
  let frames = [];

  let flushTimer = null;

  // A) Separate locks so slow events don't block frames (or vice versa)
  let flushingEvents = false;
  let flushingFrames = false;

  // B) Monotonic frame sequence
  let frameSeq = 0;

  // Lifecycle handler teardown fns
  let teardownFns = [];

  // D) De-dupe eventIds (bounded)
  const MAX_EVENT_IDS = 4000;
  const seenEventIds = new Map(); // eventId -> timestamp

  function nowMs() {
    return Date.now();
  }

  function endpointEvents() {
    return `${apiBase}/plays/${playId}/events`;
  }

  function endpointFrames() {
    return `${apiBase}/plays/${playId}/frames`;
  }

  function rememberEventId(id, ts) {
    seenEventIds.set(id, ts);
    if (seenEventIds.size <= MAX_EVENT_IDS) return;

    // Evict oldest ~10% to keep it cheap
    const evictCount = Math.ceil(MAX_EVENT_IDS * 0.1);
    let i = 0;
    for (const key of seenEventIds.keys()) {
      seenEventIds.delete(key);
      i++;
      if (i >= evictCount) break;
    }
  }

  function isDupEventId(id) {
    if (!id) return false;
    return seenEventIds.has(id);
  }

  function enqueueEvent(evt) {
    events.push(evt);
    if (events.length >= maxEvents) void flushEvents();
  }

  function enqueueFrame(frame) {
    frames.push(frame);
    if (frames.length >= maxFrames) void flushFrames();
  }

  async function postJson(url, body, { keepalive = false } = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive,
      ...(includeCredentials ? { credentials: "include" } : null),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Telemetry POST failed (${res.status}): ${text}`);
    }
  }

  // C) Best-effort beacon flush (works during unload in many browsers)
  function sendBeaconJson(url, payload) {
    try {
      if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
        return false;
      }
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      return navigator.sendBeacon(url, blob);
    } catch {
      return false;
    }
  }

  async function flushEvents() {
    if (flushingEvents) return;
    if (events.length === 0) return;

    flushingEvents = true;
    const batch = events;
    events = [];

    try {
      await postJson(endpointEvents(), { events: batch });
    } catch (err) {
      // put back (at front) so we retry later
      events = batch.concat(events);
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      flushingEvents = false;
    }
  }

  async function flushFrames() {
    if (flushingFrames) return;
    if (frames.length === 0) return;

    flushingFrames = true;
    const batch = frames;
    frames = [];

    try {
      await postJson(endpointFrames(), { frames: batch });
    } catch (err) {
      frames = batch.concat(frames);
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      flushingFrames = false;
    }
  }

  async function flushAll() {
    // run in parallel now that locks are separate
    await Promise.all([flushEvents(), flushFrames()]);
  }

  function startAutoFlush() {
    if (flushTimer) return;

    flushTimer = window.setInterval(() => void flushAll(), flushEveryMS);

    // Make sure we don't run the unload flush twice
    let didPageFlush = false;

    const flushOnHide = () => {
      if (didPageFlush) return;
      didPageFlush = true;

      // Snapshot buffers
      const evts = events;
      const frs = frames;

      // Clear immediately to avoid double-send if app continues
      events = [];
      frames = [];

      // Try sendBeacon first
      const sentEvents = evts.length
        ? sendBeaconJson(endpointEvents(), { events: evts })
        : true;
      const sentFrames = frs.length
        ? sendBeaconJson(endpointFrames(), { frames: frs })
        : true;

      // Fallback: keepalive fetch
      if (evts.length && !sentEvents) {
        void postJson(endpointEvents(), { events: evts }, { keepalive: true }).catch(() => {
          // If we're not actually unloading (e.g. visibilitychange), restore
          events = evts.concat(events);
        });
      }

      if (frs.length && !sentFrames) {
        void postJson(endpointFrames(), { frames: frs }, { keepalive: true }).catch(() => {
          frames = frs.concat(frames);
        });
      }
    };

    // pagehide is better than beforeunload for mobile + bfcache
    window.addEventListener("pagehide", flushOnHide);

    // Some browsers prefer visibilitychange
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushOnHide();
    };
    document.addEventListener("visibilitychange", onVisibility);

    teardownFns.push(() => window.removeEventListener("pagehide", flushOnHide));
    teardownFns.push(() => document.removeEventListener("visibilitychange", onVisibility));
  }

  function stopAutoFlush() {
    if (flushTimer) {
      window.clearInterval(flushTimer);
      flushTimer = null;
    }
    for (const fn of teardownFns) fn();
    teardownFns = [];
  }

  return {
    playId,

    /**
     * Emits a telemetry event.
     *
     * IMPORTANT:
     * - If payload.eventId is provided, the bus will de-dupe on it.
     * - We also lift eventId to the top-level event object for easier backend handling.
     */
    emitEvent(type, payload = {}, timestamp = nowMs()) {
      const eventId = payload?.eventId;

      if (isDupEventId(eventId)) return;
      if (eventId) rememberEventId(eventId, timestamp);

      // Store eventId at top-level as well as in payload (if you keep it there)
      // so your server can index it easily.
      enqueueEvent({
        type,
        timestamp,
        eventId: eventId ?? undefined,
        ...payload,
      });
    },

    /**
     * Records a pose frame.
     * Adds seq + timestamp so server can detect gaps / ordering.
     */
    recordPoseFrame(frame) {
      const timestamp = frame?.timestamp ?? nowMs();
      const seq = frame?.seq ?? frameSeq++;
      enqueueFrame({ ...frame, seq, timestamp });
    },

    flushEvents,
    flushFrames,
    flushAll,

    startAutoFlush,
    stopAutoFlush,

    async uploadMedia(blob, fieldName = "video") {
      const form = new FormData();
      form.append(fieldName, blob);

      const res = await fetch(`${apiBase}/plays/${playId}/media`, {
        method: "POST",
        body: form,
        ...(includeCredentials ? { credentials: "include" } : null),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Media upload failed (${res.status}): ${text}`);
      }
    },
  };
}
