"use client";

/**
 * Telemetry bus: buffers events + pose frames and flushes in batches.
 * No UI assumptions. Safe to call frequently (every tick).
 */
export function createTelemetryBus({
  playId,
  flushEveryMS = 2000,
  maxEvents = 50,
  maxFrames = 60,
  apiBase = "/api",
} = {}) {
  if (!playId) {
    throw new Error("createTelemetryBus: playId is required");
  }

  let events = [];
  let frames = [];
  let flushTimer = null;
  let flushing = false;

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

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Don’t throw away data silently—surface an error
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Telemetry POST failed (${res.status}): ${text}`);
    }
  }

  async function flushEvents() {
    if (flushing) return;
    if (events.length === 0) return;

    flushing = true;
    const batch = events;
    events = [];

    try {
      await postJson(`${apiBase}/plays/${playId}/events`, {
        events: batch, // ✅ batch schema (recommended)
      });
    } catch (err) {
      // put back (at front) so we retry later
      events = batch.concat(events);
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      flushing = false;
    }
  }

  async function flushFrames() {
    if (flushing) return;
    if (frames.length === 0) return;

    flushing = true;
    const batch = frames;
    frames = [];

    try {
      await postJson(`${apiBase}/plays/${playId}/frames`, {
        frames: batch, // ✅ batch schema
      });
    } catch (err) {
      frames = batch.concat(frames);
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      flushing = false;
    }
  }

  async function flushAll() {
    // flush sequentially to avoid overloading server / race
    await flushEvents();
    await flushFrames();
  }

  function startAutoFlush() {
    if (flushTimer) return;
    flushTimer = window.setInterval(() => {
      void flushAll();
    }, flushEveryMS);
  }

  function stopAutoFlush() {
    if (!flushTimer) return;
    window.clearInterval(flushTimer);
    flushTimer = null;
  }

  return {
    playId,

    emitEvent(type, payload = {}, timestamp = nowMs()) {
      enqueueEvent({ type, timestamp, payload });
    },

    // Use for pose frames (already serialized/compacted by your pose serializer)
    recordPoseFrame(frame) {
      enqueueFrame(frame);
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
