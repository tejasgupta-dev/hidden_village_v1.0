"use client";

import { useEffect, useRef } from "react";

/**
 * useRafTick
 *
 * Runs a requestAnimationFrame loop and calls `onTick`
 * with timing information.
 *
 * @param {Object} options
 * @param {(info: { now: number, dt: number, elapsed: number }) => void} options.onTick
 * @param {boolean} options.enabled - whether the loop should run
 */
export function useRafTick({ onTick, enabled = true }) {
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastTimeRef = useRef(null);
  const savedCallback = useRef(onTick);

  // Always keep latest callback (prevents stale closures)
  useEffect(() => {
    savedCallback.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    function loop(now) {
      if (startTimeRef.current === null) {
        startTimeRef.current = now;
        lastTimeRef.current = now;
      }

      const dt = now - lastTimeRef.current;
      const elapsed = now - startTimeRef.current;

      lastTimeRef.current = now;

      savedCallback.current?.({
        now,
        dt,
        elapsed,
      });

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      startTimeRef.current = null;
      lastTimeRef.current = null;
    };
  }, [enabled]);
}
