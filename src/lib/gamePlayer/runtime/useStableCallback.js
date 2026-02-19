"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * useStableCallback
 *
 * Returns a stable function reference that always calls
 * the latest version of the callback.
 *
 * Prevents stale closures in:
 * - requestAnimationFrame
 * - setTimeout / setInterval
 * - event listeners
 * - external subscriptions
 */
export function useStableCallback(fn) {
  const fnRef = useRef(fn);

  // Update ref synchronously before paint
  useLayoutEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  // Stable function identity
  return useCallback((...args) => {
    return fnRef.current?.(...args);
  }, []);
}
