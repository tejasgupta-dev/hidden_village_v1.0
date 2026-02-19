"use client";

import { useEffect, useRef, useState } from "react";
import { enrichLandmarks } from "@/lib/pose/landmark";

/**
 * Starts MediaPipe Holistic using an explicit videoRef (no DOM querying).
 * This eliminates the "works only after reload" race.
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

    const stopVideoStreamTracks = () => {
      const videoEl = videoRef?.current;
      if (!videoEl) return;

      const stream = videoEl.srcObject;
      if (stream && typeof stream.getTracks === "function") {
        try {
          stream.getTracks().forEach((t) => {
            try {
              t.stop();
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

    const initialize = async () => {
      try {
        setLoading(true);
        setError(null);
        loadingRef.current = true;

        const videoEl = videoRef?.current;
        if (!videoEl) {
          // If the ref isn't ready yet, try again on the next tick
          // (this is the main fix for route-transition timing)
          await new Promise((r) => setTimeout(r, 0));
        }

        const videoElement = videoRef?.current;
        if (!videoElement) {
          setError("Video ref not ready");
          setLoading(false);
          return;
        }

        // Dynamically import MediaPipe modules
        const cameraUtils = await import("@mediapipe/camera_utils");
        const holisticModule = await import("@mediapipe/holistic");

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

        const camera = new Camera(videoElement, {
          onFrame: async () => {
            if (isCleanedUp) return;

            if (videoElement.readyState < 2) return;

            try {
              await holistic.send({ image: videoElement });
            } catch {
              // ignore shutdown races
            }
          },
          width,
          height,
          facingMode: "user",
        });

        cameraRef.current = camera;
        holisticRef.current = holistic;

        await camera.start();
      } catch (err) {
        if (!isCleanedUp) {
          setError(err?.message ?? String(err));
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isCleanedUp = true;

      try {
        cameraRef.current?.stop?.();
      } catch {}
      try {
        holisticRef.current?.close?.();
      } catch {}

      cameraRef.current = null;
      holisticRef.current = null;

      stopVideoStreamTracks();
    };
  }, [videoRef, width, height]);

  return { loading, error };
}
