"use client";

/**
 * Telemetry bus: buffers events + pose frames and flushes in batches.
 *
 * Features:
 * A) Separate flush locks for events vs frames (prevents one starving the other)
 * B) Monotonic frame sequence numbers (and timestamps) for detecting gaps
 * C) Flush on page hide/unload using sendBeacon (best-effort) + keepalive fallback
 * D) De-dupe events by eventId (prevents dev StrictMode double-logs + accidental double dispatch)
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

  let flushingEvents = false;
  let flushingFrames = false;

  // Monotonic frame sequence
  let frameSeq = 0;

  let teardownFns = [];

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
    await Promise.all([flushEvents(), flushFrames()]);
  }

  function startAutoFlush() {
    if (flushTimer) return;

    flushTimer = window.setInterval(() => void flushAll(), flushEveryMS);

    let didPageFlush = false;

    const flushOnHide = () => {
      if (didPageFlush) return;
      didPageFlush = true;

      const evts = events;
      const frs = frames;

      events = [];
      frames = [];

      const sentEvents = evts.length ? sendBeaconJson(endpointEvents(), { events: evts }) : true;
      const sentFrames = frs.length ? sendBeaconJson(endpointFrames(), { frames: frs }) : true;

      if (evts.length && !sentEvents) {
        void postJson(endpointEvents(), { events: evts }, { keepalive: true }).catch(() => {
          events = evts.concat(events);
        });
      }

      if (frs.length && !sentFrames) {
        void postJson(endpointFrames(), { frames: frs }, { keepalive: true }).catch(() => {
          frames = frs.concat(frames);
        });
      }
    };

    window.addEventListener("pagehide", flushOnHide);

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

    emitEvent(type, payload = {}, timestamp = nowMs()) {
      const eventId = payload?.eventId;

      if (isDupEventId(eventId)) return;
      if (eventId) rememberEventId(eventId, timestamp);

      enqueueEvent({
        type,
        timestamp,
        eventId: eventId ?? undefined,
        ...payload,
      });
    },

    /**
     * Records a pose frame.
     * ✅ If caller provides seq, we use it and advance internal counter to avoid collisions.
     */
    recordPoseFrame(frame) {
      const timestamp = frame?.timestamp ?? nowMs();

      if (Number.isFinite(Number(frame?.seq))) {
        const s = Number(frame.seq);
        frameSeq = Math.max(frameSeq, s + 1);
        enqueueFrame({ ...frame, seq: s, timestamp });
        return;
      }

      const seq = frameSeq++;
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