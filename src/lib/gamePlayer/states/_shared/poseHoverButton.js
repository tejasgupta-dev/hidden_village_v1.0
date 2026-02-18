"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hover-to-click button:
 * - Normal mouse click works
 * - If pointer hovers for hoverDelayMS, fires onClick once
 * - Great with PoseCursor if it drives pointer hover events over DOM elements
 */
export default function PoseHoverButton({
  disabled = false,
  hoverEnabled = true,
  hoverDelayMS = 900,
  onClick,
  children,
  className = "",
}) {
  const [hovering, setHovering] = useState(false);
  const firedRef = useRef(false);
  const timerRef = useRef(null);

  function clear() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    firedRef.current = false;
  }

  useEffect(() => {
    // cleanup on unmount
    return () => clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    clear();
    if (disabled) return;
    if (!hoverEnabled) return;
    if (!hovering) return;

    timerRef.current = window.setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onClick?.();
    }, hoverDelayMS);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovering, disabled, hoverEnabled, hoverDelayMS]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        clear();
        onClick?.();
      }}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => {
        setHovering(false);
        clear();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
