"use client";

import { useEffect, useRef, useState } from "react";

export default function PoseCursor({
  poseDataRef,
  containerWidth,
  containerHeight,
  onClick,
  sensitivity = 1.2,
  hand = "left", // "left" or "right"
  hoverSelector = ".next-button",
}) {
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isClicking, setIsClicking] = useState(false);
  const [hoverStartTime, setHoverStartTime] = useState(null);

  const lastClickTime = useRef(0);
  const hoverElement = useRef(null);

  const HOVER_THRESHOLD = 200;
  const CLICK_COOLDOWN_MS = 600;

  useEffect(() => {
    let rafId;

    const loop = () => {
      const poseData = poseDataRef?.current;
      const handKey = hand === "right" ? "rightHandLandmarks" : "leftHandLandmarks";
      const handLm = poseData?.[handKey];

      if (!handLm?.[8]) {
        setHoverStartTime(null);
        hoverElement.current = null;
        setIsClicking(false);
        rafId = requestAnimationFrame(loop);
        return;
      }

      const indexFinger = handLm[8];
      const palm = handLm[0];

      // Map normalized [0..1] to viewport coordinates
      let x = indexFinger.x * containerWidth;
      let y = indexFinger.y * containerHeight;

      // Sensitivity scales movement around center
      // (Instead of multiplying absolute pos, scale delta from center)
      const cx = containerWidth / 2;
      const cy = containerHeight / 2;
      x = cx + (x - cx) * sensitivity;
      y = cy + (y - cy) * sensitivity;

      // Bound to viewport
      const boundedX = Math.min(Math.max(x, 0), containerWidth);
      const boundedY = Math.min(Math.max(y, 0), containerHeight);

      setCursorPos({ x: boundedX, y: boundedY });

      // elementsFromPoint expects viewport coords, which these are (since container = window)
      const elementsAtPoint = document.elementsFromPoint(boundedX, boundedY);

      // Find hover target
      const hoverTarget = elementsAtPoint.find((el) => {
        try {
          return el.matches?.(hoverSelector);
        } catch {
          return false;
        }
      });

      if (hoverTarget) {
        if (!hoverStartTime) {
          setHoverStartTime(Date.now());
          hoverElement.current = hoverTarget;
        } else if (
          hoverElement.current === hoverTarget &&
          Date.now() - hoverStartTime >= HOVER_THRESHOLD
        ) {
          const now = Date.now();
          if (now - lastClickTime.current > CLICK_COOLDOWN_MS) {
            setIsClicking(true);
            lastClickTime.current = now;
            onClick?.(boundedX, boundedY);
            setHoverStartTime(null);
            hoverElement.current = null;
          }
        }
      } else {
        setHoverStartTime(null);
        hoverElement.current = null;
        setIsClicking(false);
      }

      // Optional "pinch click": index to palm distance in normalized coords
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
            onClick?.(boundedX, boundedY);
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
    // hoverStartTime and isClicking intentionally omitted to avoid restarting RAF
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseDataRef, containerWidth, containerHeight, onClick, sensitivity, hand, hoverSelector]);

  const hoverProgress =
    hoverStartTime ? Math.min(1, (Date.now() - hoverStartTime) / HOVER_THRESHOLD) : 0;

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
            : hoverStartTime
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
