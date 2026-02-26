"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";

function formatStopwatch(ms) {
  const t = Math.max(0, Math.floor(Number(ms) || 0));
  const totalSeconds = Math.floor(t / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((t % 1000) / 10);

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const cc = String(centis).padStart(2, "0");
  return `${mm}:${ss}.${cc}`;
}

export default function PauseUI({ session, dispatch, onBackToMenu }) {
  const paused = !!session?.flags?.paused;

  const onPause = useCallback(() => dispatch(commands.pause()), [dispatch]);
  const onResume = useCallback(() => dispatch(commands.resume()), [dispatch]);

  const onMenu = useCallback(() => {
    onBackToMenu?.();
  }, [onBackToMenu]);

  // ---- Stopwatch that does NOT restart and freezes while paused ----
  const startedAtRef = useRef(null); // perf.now at start of current running segment
  const accumulatedRef = useRef(0); // ms accumulated across segments
  const rafRef = useRef(null);

  const [displayMs, setDisplayMs] = useState(0);

  const perfNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  // Initialize stopwatch base from session.time.elapsed exactly once (if available)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    const seed = Number(session?.time?.elapsed ?? 0);
    if (Number.isFinite(seed) && seed > 0) {
      accumulatedRef.current = seed;
      setDisplayMs(seed);
    }
    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // When paused: freeze and stop RAF updates.
    if (paused) {
      if (startedAtRef.current != null) {
        accumulatedRef.current += perfNow() - startedAtRef.current;
        startedAtRef.current = null;
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setDisplayMs(accumulatedRef.current);
      return;
    }

    // When running: start (or resume) RAF loop.
    if (startedAtRef.current == null) startedAtRef.current = perfNow();

    const loop = () => {
      const base = accumulatedRef.current;
      const seg = startedAtRef.current == null ? 0 : perfNow() - startedAtRef.current;
      setDisplayMs(base + seg);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const label = useMemo(() => formatStopwatch(displayMs), [displayMs]);

  // keyboard shortcut: Esc pauses/resumes
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (paused) onResume();
      else onPause();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paused, onPause, onResume]);

  // ✅ Shared pose-cursor clickable button base
  // Added "pause-ui-button" so PoseCursor can target these only while paused.
  const baseBtn =
    "next-button pause-ui-button relative overflow-hidden rounded-[28px] ring-2 transition-all duration-150 select-none pointer-events-auto";
  const idleBtn = "bg-black/35 ring-white/20 hover:bg-black/25 hover:ring-white/35";
  const accentBtn = "bg-white/15 ring-white/35 hover:bg-white/20 hover:ring-white/50";

  return (
    <div className={["absolute inset-0 z-[80]", paused ? "pointer-events-auto" : "pointer-events-none"].join(" ")}>
      {/* Stopwatch (always visible; doesn't need clicks) */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="px-3 py-2 rounded-xl bg-black/35 ring-1 ring-white/15 backdrop-blur-md text-white/90 font-mono text-sm">
          {label}
          {paused ? <span className="ml-2 text-white/50">(paused)</span> : null}
        </div>
      </div>

      {/* NOT paused: small Pause button */}
      {!paused && (
        <div className="absolute top-4 right-4 pointer-events-auto">
          <button
            type="button"
            onClick={onPause}
            data-pose-hover-ms={650}
            className={[baseBtn, accentBtn, "px-6 py-3 text-base font-semibold"].join(" ")}
            aria-label="Pause game"
          >
            Pause
          </button>
        </div>
      )}

      {/* Paused UI */}
      {paused && (
        <div className="absolute inset-0 z-[90]">
          {/* blocker for real pointer clicks */}
          <div className="absolute inset-0 bg-black/55 pointer-events-auto" />

          {/* Buttons layer */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Big resume button */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                type="button"
                onClick={onResume}
                data-pose-hover-ms={650}
                className={[
                  baseBtn,
                  "bg-white/20 ring-white/45 hover:bg-white/25 hover:ring-white/60",
                  "px-10 py-6 text-3xl font-bold text-white",
                ].join(" ")}
                aria-label="Resume game"
              >
                Resume
              </button>
            </div>

            {/* Bottom-left back to menu */}
            <div className="absolute bottom-4 left-4 pointer-events-none">
              <button
                type="button"
                onClick={onMenu}
                data-pose-hover-ms={750}
                className={[baseBtn, idleBtn, "px-4 py-2 text-sm font-medium text-white/90"].join(" ")}
                aria-label="Back to menu"
              >
                Back to menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}