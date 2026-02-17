"use client";

import { useEffect, useRef, useState } from "react";
import { enrichLandmarks } from "@/lib/pose/landmark";

const GetPoseData = ({ width, height, onPoseData }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cameraRef = useRef(null);
  const holisticRef = useRef(null);

  useEffect(() => {
    let isCleanedUp = false;

    const initializeMediaPipe = async () => {
      try {
        // Wait a bit for DOM to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        const videoElement = document.getElementsByClassName("input-video")[0];

        if (!videoElement) {
          setError("Video element not found");
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

          // IMPORTANT: Holistic can fire without poseLandmarks early on
          if (!results) return;

          const enriched = enrichLandmarks(results);

          // ✅ This is what your GamePlayerRoot needs:
          onPoseData?.(enriched);

          // ✅ Stop loading as soon as we get *any* results
          // (not only when poseLandmarks exist)
          if (loading) setLoading(false);
        });

        const camera = new Camera(videoElement, {
          onFrame: async () => {
            if (isCleanedUp) return;

            // Optional guard: wait until video has a frame
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

    initializeMediaPipe();

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  return { loading, error };
};

export default GetPoseData;
