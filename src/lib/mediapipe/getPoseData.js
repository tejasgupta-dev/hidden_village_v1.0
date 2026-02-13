"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { enrichLandmarks } from "@/lib/pose/landmark";

const GetPoseData = ({ width, height }) => {
  const [loading, setLoading] = useState(true);
  const [poseData, setPoseData] = useState(null);
  const [error, setError] = useState(null);
  
  // Use refs to avoid recreating functions
  const cameraRef = useRef(null);
  const holisticRef = useRef(null);

  useEffect(() => {
    let camera;
    let holistic;
    let isCleanedUp = false;

    const initializeMediaPipe = async () => {
      try {
        // Wait a bit for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        const videoElement = document.getElementsByClassName("input-video")[0];
        
        if (!videoElement) {
          console.error("Video element not found");
          setError("Video element not found");
          setLoading(false);
          return;
        }

        // Dynamically import MediaPipe modules
        const cameraUtils = await import("@mediapipe/camera_utils");
        const holisticModule = await import("@mediapipe/holistic");

        const Camera = cameraUtils.Camera;
        const Holistic = holisticModule.Holistic;

        holistic = new Holistic({
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

        // Update pose results callback - using a stable function
        const updatePoseResults = (newResults) => {
          if (isCleanedUp) return;
          
          // Only update if we have valid landmarks
          if (newResults && newResults.poseLandmarks) {
            const enriched = enrichLandmarks(newResults);
            setPoseData(enriched);
            
            if (loading) {
              setLoading(false);
            }
          }
        };

        holistic.onResults(updatePoseResults);

        const poseDetectionFrame = async () => {
          if (isCleanedUp) return;
          
          try {
            await holistic.send({ image: videoElement });
          } catch (err) {
            if (!isCleanedUp) {
              console.error("Error in pose detection frame:", err);
            }
          }
        };

        camera = new Camera(videoElement, {
          onFrame: poseDetectionFrame,
          width: width,
          height: height,
          facingMode: "user",
        });

        // Store refs
        cameraRef.current = camera;
        holisticRef.current = holistic;
        
        await camera.start();
      } catch (err) {
        if (!isCleanedUp) {
          console.error("Error initializing MediaPipe:", err);
          setError(err.message);
          setLoading(false);
        }
      }
    };

    initializeMediaPipe();

    // Cleanup function
    return () => {
      isCleanedUp = true;
      
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (err) {
          console.error("Error stopping camera:", err);
        }
      }
      
      if (holisticRef.current) {
        try {
          holisticRef.current.close();
        } catch (err) {
          console.error("Error closing holistic:", err);
        }
      }
      
      cameraRef.current = null;
      holisticRef.current = null;
    };
  }, [width, height]); // Only re-run if width or height changes

  return { poseData, loading, error };
};

export default GetPoseData;