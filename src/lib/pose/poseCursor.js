"use client";

import { useEffect, useRef, useState } from "react";

export default function PoseCursor({
  poseDataRef,
  containerWidth,
  containerHeight,
  onClick, // used ONLY for pinch / non-button clicks
  sensitivity = 1.2,
  hand = "left", // "left" or "right"
  hoverSelector = ".next-button",
  hoverThresholdMS = 200,
}) {
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isClicking, setIsClicking] = useState(false);

  // refs so RAF loop uses current values (no stale React state)
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

      if (!handLm?.[8]) {
        hoverStartRef.current = null;
        hoverElRef.current = null;
        setIsClicking(false);
        rafId = requestAnimationFrame(loop);
        return;
      }

      const indexFinger = handLm[8];
      const palm = handLm[0];

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
          return el.matches?.(hoverSelector);
        } catch {
          return false;
        }
      });

      // ✅ Hover-to-click: ONLY click the element (do NOT also call onClick)
      if (hoverTarget) {
        const nowPerf = performance.now();

        if (hoverElRef.current !== hoverTarget) {
          hoverElRef.current = hoverTarget;
          hoverStartRef.current = nowPerf;
        } else {
          const started = hoverStartRef.current ?? nowPerf;

          if (nowPerf - started >= hoverThresholdMS) {
            const now = Date.now();

            if (now - lastClickTime.current > CLICK_COOLDOWN_MS) {
              setIsClicking(true);
              lastClickTime.current = now;

              // Real DOM click so React button onClick runs once
              hoverTarget.dispatchEvent(new MouseEvent("click", { bubbles: true }));

              // reset hover tracking
              hoverStartRef.current = null;
              hoverElRef.current = null;
            }
          }
        }
      } else {
        hoverStartRef.current = null;
        hoverElRef.current = null;
        setIsClicking(false);
      }

      // ✅ Pinch click: if hovering a target, click it; else call onClick
      if (palm) {
        const dx = indexFinger.x - palm.x;
        const dy = indexFinger.y - palm.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // tweak threshold based on your data
        if (distance < 0.12) {
          const now = Date.now();

          if (now - lastClickTime.current > CLICK_COOLDOWN_MS) {
            setIsClicking(true);
            lastClickTime.current = now;

            if (hoverTarget) {
              hoverTarget.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            } else {
              onClick?.(boundedX, boundedY);
            }

            // prevent immediate re-trigger on the same element
            hoverStartRef.current = null;
            hoverElRef.current = null;
          }
        }
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
    onClick,
    sensitivity,
    hand,
    hoverSelector,
    hoverThresholdMS,
  ]);

  // purely cosmetic: orange pulse when “arming” hover
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
