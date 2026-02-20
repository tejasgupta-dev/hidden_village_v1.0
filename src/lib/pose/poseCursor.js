"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function PoseCursor({
  poseDataRef,
  containerWidth,
  containerHeight,
  sensitivity = 1.2,
  hand = "left", // "left" or "right"
  hoverSelector = ".next-button",

  // default fallback if a button doesn't provide data-pose-hover-ms
  hoverThresholdMS = 700,

  // optional safety: only click elements that opt-in
  requireOptIn = false, // if true, requires data-pose-click="true"

  // jitter safety: cursor must remain on the same element continuously
  // (already implied by our logic, but leaving here for clarity)
}) {
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isClicking, setIsClicking] = useState(false);

  const hoverStartRef = useRef(null);
  const hoverElRef = useRef(null);

  // store the current threshold for the hovered element
  const hoverThresholdRef = useRef(hoverThresholdMS);

  const lastClickTime = useRef(0);
  const isClickingRef = useRef(false);

  const CLICK_COOLDOWN_MS = 600;

  const safePerfNow = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();

  function readHoverMS(el) {
    const raw = el?.getAttribute?.("data-pose-hover-ms");
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
    return hoverThresholdMS;
  }

  function isDisabledEl(el) {
    return (
      (typeof el.disabled === "boolean" && el.disabled) ||
      el.getAttribute?.("aria-disabled") === "true"
    );
  }

  function setElProgress(el, progress01) {
    try {
      el?.style?.setProperty("--pose-progress", String(progress01));
    } catch {}
  }

  function clearElProgress(el) {
    try {
      el?.style?.removeProperty("--pose-progress");
    } catch {}
  }

  useEffect(() => {
    let rafId;

    const loop = () => {
      const poseData = poseDataRef?.current;
      const handKey = hand === "right" ? "rightHandLandmarks" : "leftHandLandmarks";
      const handLm = poseData?.[handKey];

      // If no hand, stop hover tracking (no click)
      if (!handLm?.[8]) {
        // clear progress on the last hovered element
        if (hoverElRef.current) clearElProgress(hoverElRef.current);

        hoverStartRef.current = null;
        hoverElRef.current = null;
        hoverThresholdRef.current = hoverThresholdMS;

        setIsClicking(false);
        isClickingRef.current = false;

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
          if (requireOptIn && el.getAttribute?.("data-pose-click") !== "true") return false;
          if (isDisabledEl(el)) return false;
          return true;
        } catch {
          return false;
        }
      });

      const nowPerf = safePerfNow();

      if (hoverTarget) {
        // new target: reset timer + progress on old element
        if (hoverElRef.current !== hoverTarget) {
          if (hoverElRef.current) clearElProgress(hoverElRef.current);

          hoverElRef.current = hoverTarget;
          hoverStartRef.current = nowPerf;

          const threshold = readHoverMS(hoverTarget);
          hoverThresholdRef.current = threshold;

          // set initial progress
          setElProgress(hoverTarget, 0);
        } else {
          const started = hoverStartRef.current ?? nowPerf;
          const threshold = hoverThresholdRef.current ?? hoverThresholdMS;

          const elapsed = nowPerf - started;
          const progress = threshold > 0 ? Math.min(1, elapsed / threshold) : 1;

          // ✅ drive button progress bar via CSS var
          setElProgress(hoverTarget, progress);

          // threshold satisfied → click (with cooldown)
          if (elapsed >= threshold) {
            const now = Date.now();
            if (now - lastClickTime.current > CLICK_COOLDOWN_MS) {
              setIsClicking(true);
              isClickingRef.current = true;
              lastClickTime.current = now;

              // ✅ real DOM click so React onClick runs
              hoverTarget.dispatchEvent(new MouseEvent("click", { bubbles: true }));

              // reset hover tracking after click (and clear progress)
              clearElProgress(hoverTarget);
              hoverStartRef.current = null;
              hoverElRef.current = null;
              hoverThresholdRef.current = hoverThresholdMS;
            }
          }
        }
      } else {
        // left all valid targets → clear progress + reset
        if (hoverElRef.current) clearElProgress(hoverElRef.current);

        hoverStartRef.current = null;
        hoverElRef.current = null;
        hoverThresholdRef.current = hoverThresholdMS;

        setIsClicking(false);
        isClickingRef.current = false;
      }

      // reset click highlight shortly after
      if (isClickingRef.current) {
        const now = Date.now();
        if (now - lastClickTime.current > 120) {
          setIsClicking(false);
          isClickingRef.current = false;
        }
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
    requireOptIn,
  ]);

  // cosmetic hover progress (for cursor color only)
  const hoverProgress = useMemo(() => {
    if (!hoverStartRef.current) return 0;
    const threshold = hoverThresholdRef.current ?? hoverThresholdMS;
    if (!threshold || threshold <= 0) return 1;
    const elapsed = safePerfNow() - hoverStartRef.current;
    return Math.min(1, elapsed / threshold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorPos.x, cursorPos.y, hoverThresholdMS]);

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
            ? `rgba(0, 200, 0, ${hoverProgress})`
            : "rgba(255, 255, 255, 0.6)",
          border: "3px solid white",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 10px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
}
