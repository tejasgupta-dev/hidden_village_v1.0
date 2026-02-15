"use client";

import { useEffect, useRef } from "react";
import { PoseMatch } from "@/lib/pose/poseMatching";

export default function PoseMatchState({
  poseDataRef,
  posesToMatch,
  onComplete,
  storeFrameBatch,
  storeEvent
}) {
  const frameBuffer = useRef([]);

  /*
  Buffer frames for batch storage
  No state updates - just collect data
  */
  useEffect(() => {
    let rafId;

    const update = () => {
      const data = poseDataRef.current;

      if (data) {
        frameBuffer.current.push({
          poseData: data,
          timestamp: Date.now()
        });

        if (frameBuffer.current.length >= 30) {
          storeFrameBatch?.(frameBuffer.current);
          frameBuffer.current = [];
        }
      }

      rafId = requestAnimationFrame(update);
    };

    update();

    return () => {
      cancelAnimationFrame(rafId);
      
      if (frameBuffer.current.length > 0) {
        storeFrameBatch?.(frameBuffer.current);
        frameBuffer.current = [];
      }
    };
  }, [poseDataRef, storeFrameBatch]);

  function complete() {
    if (frameBuffer.current.length > 0) {
      storeFrameBatch?.(frameBuffer.current);
      frameBuffer.current = [];
    }
    
    storeEvent?.("pose_match_complete");
    onComplete?.();
  }

  return (
    <div className="flex flex-col items-center">
      <PoseMatch
        poseDataRef={poseDataRef}
        posesToMatch={posesToMatch}
      />

      <button
        onClick={complete}
        className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
      >
        Continue
      </button>
    </div>
  );
}