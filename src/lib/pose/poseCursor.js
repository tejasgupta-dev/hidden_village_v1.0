"use client";

import { useEffect, useRef, useState } from "react";

export default function PoseCursor({
  poseDataRef,
  containerWidth,
  containerHeight,
  // onClick is intentionally unused now: we only click the hovered DOM button
  sensitivity = 1.2,
  hand = "left", // "left" or "right"
  hoverSelector = ".next-button",
  hoverThresholdMS = 200,
}) {
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isClicking, setIsClicking] = useState(false);

  const hoverStartRef = useRef(null);
  const hoverElRef = useRef(null);
  const lastClickTime = useRef(0);

  const CLICK_COOLDOWN_MS = 600;

  useEffect(() => {
    let rafId;

    const loop = () => {
      const poseData = poseDataRef?.current;
      const handKey = hand === "right" ? "rightHandLandmarks" : "leftHandLandmarks";
      const handLm = poseData?.[handKey];

      // If no hand, stop hover tracking (no click)
      if (!handLm?.[8]) {
        hoverStartRef.current = null;
        hoverElRef.current = null;
        setIsClicking(false);
        rafId = requestAnimationFrame(loop);
        return;
      }

      const indexFinger = handLm[8];

      // Map normalized [0..1] → viewport coords
      let x = indexFinger.x * containerWidth;
      let y = indexFinger.y * containerHeight;

      // Sensitivity scales delta from center
      const cx = containerWidth / 2;
      const cy = containerHeight / 2;
      x = cx + (x - cx) * sensitivity;
      y = cy + (y - cy) * sensitivity;

      // Bound to viewport
      const boundedX = Math.min(Math.max(x, 0), containerWidth);
      const boundedY = Math.min(Math.max(y, 0), containerHeight);

      setCursorPos({ x: boundedX, y: boundedY });

      // Find element under virtual cursor
      const elementsAtPoint = document.elementsFromPoint(boundedX, boundedY);

      const hoverTarget = elementsAtPoint.find((el) => {
        try {
          if (!el.matches?.(hoverSelector)) return false;

          // ignore disabled buttons
          const isDisabled =
            // native disabled
            (typeof el.disabled === "boolean" && el.disabled) ||
            // aria disabled
            el.getAttribute?.("aria-disabled") === "true";

          return !isDisabled;
        } catch {
          return false;
        }
      });

      // ✅ ONLY hover-to-click the actual button
      if (hoverTarget) {
        const nowPerf = performance.now();

        // new target: start timer
        if (hoverElRef.current !== hoverTarget) {
          hoverElRef.current = hoverTarget;
          hoverStartRef.current = nowPerf;
        } else {
          const started = hoverStartRef.current ?? nowPerf;

          if (nowPerf - started >= hoverThresholdMS) {
            const now = Date.now();

            // cooldown so jitter doesn't spam clicks
            if (now - lastClickTime.current > CLICK_COOLDOWN_MS) {
              setIsClicking(true);
              lastClickTime.current = now;

              // ✅ real DOM click so React onClick runs (exactly once)
              hoverTarget.dispatchEvent(new MouseEvent("click", { bubbles: true }));

              // reset hover tracking after a click
              hoverStartRef.current = null;
              hoverElRef.current = null;
            }
          }
        }
      } else {
        // not hovering a valid target → no click, reset timer
        hoverStartRef.current = null;
        hoverElRef.current = null;
        setIsClicking(false);
      }

      // reset click highlight shortly after
      if (isClicking) {
        const now = Date.now();
        if (now - lastClickTime.current > 120) setIsClicking(false);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    poseDataRef,
    containerWidth,
    containerHeight,
    sensitivity,
    hand,
    hoverSelector,
    hoverThresholdMS,
  ]);

  // cosmetic hover progress
  const hoverProgress = (() => {
    if (!hoverStartRef.current) return 0;
    const elapsed = performance.now() - hoverStartRef.current;
    return Math.min(1, elapsed / hoverThresholdMS);
  })();

  return (
    <div className="pointer-events-none fixed inset-0 z-[1000]">
      <div
        className="pose-cursor"
        style={{
          position: "absolute",
          left: cursorPos.x,
          top: cursorPos.y,
          width: 24,
          height: 24,
          borderRadius: "50%",
          backgroundColor: isClicking
            ? "rgba(255, 0, 0, 0.6)"
            : hoverElRef.current
            ? `rgba(255, 165, 0, ${hoverProgress})`
            : "rgba(255, 255, 255, 0.6)",
          border: "3px solid white",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 10px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
}
