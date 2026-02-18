"use client";

/**
 * Telemetry bus: buffers events + pose frames and flushes in batches.
 * A) Separate flush locks for events vs frames (prevents one starving the other)
 * B) Add monotonic frame sequence numbers (and timestamps) for detecting gaps
 * C) Flush on page hide/unload using sendBeacon (best-effort) + keepalive fallback
 */
export function createTelemetryBus({
  playId,
  flushEveryMS = 2000,
  maxEvents = 50,
  maxFrames = 60,
  apiBase = "/api",
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

  // For pagehide/unload handlers
  let teardownFns = [];

  function nowMs() {
    return Date.now();
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
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Telemetry POST failed (${res.status}): ${text}`);
    }
  }

  function endpointEvents() {
    return `${apiBase}/plays/${playId}/events`;
  }

  function endpointFrames() {
    return `${apiBase}/plays/${playId}/frames`;
  }

  // C) Best-effort beacon flush (no retry, but works during unload in many browsers)
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
    // Can run in parallel now that locks are separate; this reduces backlog risk.
    await Promise.all([flushEvents(), flushFrames()]);
  }

  function startAutoFlush() {
    if (flushTimer) return;
    flushTimer = window.setInterval(() => void flushAll(), flushEveryMS);

    // C) Register page lifecycle flush once when autflush starts
    // Best-effort: try sendBeacon; fallback to fetch keepalive
    const onPageHide = () => {
      // Snapshot current buffers
      const evts = events;
      const frs = frames;

      // Clear immediately so we don't double-send if app continues
      events = [];
      frames = [];

      // Try sendBeacon first
      const sentEvents = evts.length ? sendBeaconJson(endpointEvents(), { events: evts }) : true;
      const sentFrames = frs.length ? sendBeaconJson(endpointFrames(), { frames: frs }) : true;

      // Fallback: keepalive fetch (still best-effort; may be ignored if too large)
      if (evts.length && !sentEvents) {
        void postJson(endpointEvents(), { events: evts }, { keepalive: true }).catch(() => {
          // If this fails during unload, we can’t recover; put back for next load only if app continues
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
    window.addEventListener("pagehide", onPageHide);
    // Some browsers still prefer visibilitychange
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onPageHide();
    };
    document.addEventListener("visibilitychange", onVisibility);

    teardownFns.push(() => window.removeEventListener("pagehide", onPageHide));
    teardownFns.push(() => document.removeEventListener("visibilitychange", onVisibility));
  }

  function stopAutoFlush() {
    if (flushTimer) {
      window.clearInterval(flushTimer);
      flushTimer = null;
    }
    // remove lifecycle handlers
    for (const fn of teardownFns) fn();
    teardownFns = [];
  }

  return {
    playId,

    emitEvent(type, payload = {}, timestamp = nowMs()) {
      enqueueEvent({ type, timestamp, payload });
    },

    /**
     * Use for pose frames (already serialized/compacted by your pose serializer).
     * B) Adds seq + timestamp so server can detect gaps / ordering.
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
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Media upload failed (${res.status}): ${text}`);
      }
    },
  };
}
