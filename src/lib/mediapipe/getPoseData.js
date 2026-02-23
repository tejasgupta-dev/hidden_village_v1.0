"use client";

import { useEffect, useRef, useState } from "react";
import { enrichLandmarks } from "@/lib/pose/landmark";

/**
 * Starts MediaPipe Holistic using an explicit videoRef (no DOM querying).
 * Cancellation-safe: guarantees camera stream stops on unmount / hide.
 *
 * Usage:
 * const videoRef = useRef(null);
 * const { loading, error } = getPoseData({ videoRef, width, height, onPoseData });
 */
export default function getPoseData({ videoRef, width, height, onPoseData }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cameraRef = useRef(null);
  const holisticRef = useRef(null);

  const onPoseDataRef = useRef(onPoseData);
  useEffect(() => {
    onPoseDataRef.current = onPoseData;
  }, [onPoseData]);

  const loadingRef = useRef(true);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    let isCleanedUp = false;

    // Capture the exact video element used for this effect instance
    let boundVideoEl = videoRef?.current ?? null;

    const stopVideoStreamTracks = (videoEl) => {
      if (!videoEl) return;

      // Stop any stream tracks attached to the element
      const stream = videoEl.srcObject;
      if (stream && typeof stream.getTracks === "function") {
        try {
          stream.getTracks().forEach((t) => {
            try {
              t.stop?.();
            } catch {}
          });
        } catch {}
      }

      try {
        videoEl.pause?.();
      } catch {}
      try {
        videoEl.srcObject = null;
      } catch {}
      try {
        videoEl.removeAttribute?.("src");
        videoEl.load?.();
      } catch {}
    };

    const safeStopAll = () => {
      // Stop MediaPipe camera + holistic
      try {
        cameraRef.current?.stop?.();
      } catch {}
      try {
        holisticRef.current?.close?.();
      } catch {}

      cameraRef.current = null;
      holisticRef.current = null;

      // Stop actual media tracks
      stopVideoStreamTracks(boundVideoEl);
    };

    const initialize = async () => {
      try {
        setLoading(true);
        setError(null);
        loadingRef.current = true;

        // Ensure we have a video element; if ref isn't ready, wait a tick
        if (!boundVideoEl) {
          await new Promise((r) => setTimeout(r, 0));
          boundVideoEl = videoRef?.current ?? null;
        }

        if (!boundVideoEl) {
          if (!isCleanedUp) {
            setError("Video ref not ready");
            setLoading(false);
          }
          return;
        }

        // Dynamically import MediaPipe modules
        const cameraUtils = await import("@mediapipe/camera_utils");
        if (isCleanedUp) return;

        const holisticModule = await import("@mediapipe/holistic");
        if (isCleanedUp) return;

        const Camera = cameraUtils.Camera;
        const Holistic = holisticModule.Holistic;

        const holistic = new Holistic({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
        });

        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: true,
          smoothSegmentation: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
          selfieMode: true,
          refineFaceLandmarks: true,
        });

        holistic.onResults((results) => {
          if (isCleanedUp) return;
          if (!results) return;

          const enriched = enrichLandmarks(results);
          onPoseDataRef.current?.(enriched);

          if (loadingRef.current) {
            loadingRef.current = false;
            setLoading(false);
          }
        });

        // Create camera AFTER holistic is ready
        const camera = new Camera(boundVideoEl, {
          onFrame: async () => {
            if (isCleanedUp) return;
            if (boundVideoEl.readyState < 2) return;

            try {
              await holistic.send({ image: boundVideoEl });
            } catch {
              // ignore shutdown races
            }
          },
          width,
          height,
          facingMode: "user",
        });

        // Store refs so cleanup can stop them even if init continues
        cameraRef.current = camera;
        holisticRef.current = holistic;

        if (isCleanedUp) {
          safeStopAll();
          return;
        }

        await camera.start();

        // If we got cleaned up while starting, stop immediately
        if (isCleanedUp) {
          safeStopAll();
          return;
        }
      } catch (err) {
        if (!isCleanedUp) {
          setError(err?.message ?? String(err));
          setLoading(false);
        } else {
          // If cleaned up, ensure nothing is still running
          safeStopAll();
        }
      }
    };

    initialize();

    return () => {
      isCleanedUp = true;
      safeStopAll();
    };
  }, [videoRef, width, height]);

  return { loading, error };
}