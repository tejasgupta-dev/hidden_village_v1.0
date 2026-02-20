"use client";

export function createLocalCameraRecorder({
  playId,
  previewVideoEl = null, // hidden is fine
  preferredMimeType = "video/webm;codecs=vp9,opus",
  videoConstraints = { width: 1280, height: 720, frameRate: 30, facingMode: "user" },
  audioConstraints = true, // mic
} = {}) {
  if (!playId) throw new Error("createLocalCameraRecorder: playId required");

  let stream = null;
  let recorder = null;
  let chunks = [];
  let startedAt = null;

  function pickMimeType(preferred) {
    const candidates = [preferred, "video/webm;codecs=vp8,opus", "video/webm"];
    for (const mt of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mt)) return mt;
    }
    return "";
  }

  function filename() {
    const iso = new Date().toISOString().replace(/[:.]/g, "-");
    return `play-${playId}-camera-${iso}.webm`;
  }

  function downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function start() {
    if (recorder) return;

    stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: audioConstraints,
    });

    // Hidden preview element: useful to keep camera "alive" on some browsers,
    // but still display:none.
    if (previewVideoEl) {
      previewVideoEl.srcObject = stream;
      previewVideoEl.muted = true; // avoid feedback
      await previewVideoEl.play().catch(() => {});
    }

    const mimeType = pickMimeType(preferredMimeType);
    chunks = [];
    startedAt = Date.now();

    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = (e) => {
      // eslint-disable-next-line no-console
      console.error("MediaRecorder error:", e);
    };

    // emit blobs periodically so stop is responsive
    recorder.start(1000);
  }

  async function stop({ download = true } = {}) {
    if (!recorder) return { blob: null, durationMs: 0 };

    const rec = recorder;
    const stopped = new Promise((resolve) => {
      rec.onstop = () => resolve();
    });

    rec.stop();
    await stopped;

    const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
    const durationMs = startedAt ? Date.now() - startedAt : 0;

    try {
      stream?.getTracks()?.forEach((t) => t.stop());
    } catch {}

    if (previewVideoEl) {
      try {
        previewVideoEl.pause();
        previewVideoEl.srcObject = null;
      } catch {}
    }

    stream = null;
    recorder = null;
    chunks = [];
    startedAt = null;

    if (download && blob.size > 0) downloadBlob(blob);

    return { blob, durationMs };
  }

  return {
    start,
    stop,
    stopAndDownload: () => stop({ download: true }),
    isRecording: () => !!recorder,
  };
}
