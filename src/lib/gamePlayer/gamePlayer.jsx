"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import IntroState from "./states/introState";
import TweenState from "./states/tweenState";
import PoseMatchState from "./states/poseMatchState";
import InsightState from "./states/insightState";
import OutroState from "./states/outroState";
import PoseCursor from "../pose/poseCursor";
import PoseDrawerLive from "../pose/poseDrawerLive";
import getPoseData from "../mediapipe/getPoseData";

export default function GamePlayer({
  gameData,
  levelIndex = 0,
  userId,
  sessionId,
  settings = {
    fps: 12,
    poseRecording: true,
    mediaRecording: true,
    eventRecording: true,
    skipStates: [],
  },
  onComplete,
}) {
  const level = gameData.levels[levelIndex];
  const dialogues = level.dialogues || { intro: [], outro: [] };
  const [stateIndex, setStateIndex] = useState(0);
  const [windowSize, setWindowSize] = useState({ width: 640, height: 480 });

  useEffect(() => {
    console.log('GameData:', gameData);
    console.log('Level:', level);
    console.log('Dialogues:', dialogues);
    console.log('Settings:', settings);
  }, [gameData, level, dialogues, settings]);
  
  // Store latest pose data in a ref (no re-renders)
  const poseDataRef = useRef(null);

  const states = ["intro", "tween", "poseMatch", "insight", "outro"];

  // Safe window size — only read on client
  useEffect(() => {
    const update = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Handle pose data updates (called 30-60 times/sec)
  const handlePoseData = useCallback((data) => {
    poseDataRef.current = data;
  }, []);

  // Handle frame capture at specified FPS
  const handleFrameCapture = useCallback(async (poseData, timestamp) => {
    if (!settings.poseRecording || !sessionId) return;

    try {
      await fetch(`/api/plays/${sessionId}/frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp,
          poseData: {
            poseLandmarks: poseData.poseLandmarks,
            leftHandLandmarks: poseData.leftHandLandmarks,
            rightHandLandmarks: poseData.rightHandLandmarks,
            faceLandmarks: settings.mediaRecording ? poseData.faceLandmarks : null,
          },
        }),
      });
    } catch (err) {
      console.error("Failed to store pose frame:", err);
    }
  }, [settings.poseRecording, settings.mediaRecording, sessionId]);

  // Call as a hook (lowercase)
  const { loading, error, videoElement } = getPoseData({
    width: 640,
    height: 480,
    onPoseData: handlePoseData,
  });

  const storeEvent = async (type, data) => {
    // Only store events if eventRecording is enabled
    if (!settings.eventRecording) return;
    
    try {
      await fetch(`/api/plays/${sessionId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data, timestamp: Date.now() }),
      });
    } catch (err) {
      console.error("Failed to store event:", err);
    }
  };

  const nextState = () => {
    let next = stateIndex + 1;
    
    // Skip states that have no data OR are in skipStates
    while (next < states.length) {
      const state = states[next];
      
      // Skip if in skipStates setting
      if (settings.skipStates?.includes(state)) {
        next++;
        continue;
      }
      
      // Skip intro/outro if no dialogues
      if (state === "intro" || state === "outro") {
        const stateDialogues = dialogues[state];
        if (!stateDialogues || !Array.isArray(stateDialogues) || stateDialogues.length === 0) {
          next++;
          continue;
        }
      }
      
      // Skip tween if no tween data
      if (state === "tween" && !level.tween) {
        next++;
        continue;
      }
      
      // Skip poseMatch if no poses
      if (state === "poseMatch" && (!level.posesToMatch || level.posesToMatch.length === 0)) {
        next++;
        continue;
      }
      
      // If we got here, this state has data
      break;
    }
    
    if (next < states.length) {
      setStateIndex(next);
    } else {
      onComplete?.();
    }
  };

  // Skip initial states without data on mount
  useEffect(() => {
    let initialIndex = 0;
    
    // Find first state with data that's not skipped
    while (initialIndex < states.length) {
      const state = states[initialIndex];
      
      // Skip if in skipStates setting
      if (settings.skipStates?.includes(state)) {
        initialIndex++;
        continue;
      }
      
      if (state === "intro" || state === "outro") {
        const stateDialogues = dialogues[state];
        if (!stateDialogues || !Array.isArray(stateDialogues) || stateDialogues.length === 0) {
          initialIndex++;
          continue;
        }
      }
      
      if (state === "tween" && !level.tween) {
        initialIndex++;
        continue;
      }
      
      if (state === "poseMatch" && (!level.posesToMatch || level.posesToMatch.length === 0)) {
        initialIndex++;
        continue;
      }
      
      break;
    }
    
    if (initialIndex !== 0) {
      setStateIndex(initialIndex);
    }
  }, [level, dialogues, settings.skipStates]);

  const renderState = () => {
    const currentState = states[stateIndex];

    switch (currentState) {
      case "intro":
        return (
          <IntroState
            dialogues={dialogues.intro ?? []}
            onComplete={nextState}
            storeEvent={storeEvent}
          />
        );
      case "tween":
        return (
          <TweenState
            tweenData={level.tween}
            onComplete={nextState}
            storeEvent={storeEvent}
          />
        );
      case "poseMatch":
        return (
          <PoseMatchState
            posesToMatch={level.posesToMatch}
            poseDataRef={poseDataRef}
            onComplete={nextState}
            storeEvent={storeEvent}
            settings={settings}
          />
        );
      case "insight":
        return (
          <InsightState
            level={level}
            onComplete={nextState}
            storeEvent={storeEvent}
          />
        );
      case "outro":
        return (
          <OutroState
            dialogues={dialogues.outro ?? []}
            onComplete={nextState}
            storeEvent={storeEvent}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {/* Hidden video element required by MediaPipe — must be in DOM */}
      {videoElement}

      {/* Live pose visualization */}
      <PoseDrawerLive
        poseDataRef={poseDataRef}
        width={windowSize.width}
        height={windowSize.height}
        similarityScores={[]}
        fps={settings.fps}
        onFrameCapture={handleFrameCapture}
      />

      {/* Pose cursor overlay */}
      <PoseCursor
        poseDataRef={poseDataRef}
        containerWidth={windowSize.width}
        containerHeight={windowSize.height}
        onClick={() => {}}
      />

      {/* Current gameplay state */}
      {loading ? (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white">
          {error ? `Error: ${error}` : "Loading pose detection..."}
        </div>
      ) : (
        renderState()
      )}
    </div>
  );
}