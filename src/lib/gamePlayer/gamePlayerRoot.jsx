"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRafTick } from "@/lib/gamePlayer/runtime/useRafTick";
import { useWindowSize } from "@/lib/gamePlayer/runtime/useWindowSize";
import { commands } from "@/lib/gamePlayer/session/commands";
import { createInitialSession, sessionReducer } from "@/lib/gamePlayer/session/reducer";
import { createTelemetryBus } from "@/lib/gamePlayer/telemetry/telemetryBus";
import { STATE_TYPES, normalizeStateType } from "@/lib/gamePlayer/states/_shared/stateTypes";

import PoseCursor from "@/lib/pose/poseCursor";
import PoseDrawer from "@/lib/pose/poseDrawer";
import getPoseData from "@/lib/mediapipe/getPoseData";

import StateRenderer from "./stateRenderer";

function isDialogueLike(type) {
  return type === STATE_TYPES.INTRO || type === STATE_TYPES.OUTRO;
}

// Small helper: derive latest pose for PoseDrawer without storing 60fps pose in React state
function usePoseDrawerPose(poseDataRef) {
  const [poseForDrawer, setPoseForDrawer] = useState(null);

  useRafTick({
    enabled: true,
    onTick: () => {
      // Only update when object identity changes (avoids unnecessary rerenders)
      const cur = poseDataRef.current ?? null;
      setPoseForDrawer((prev) => (prev === cur ? prev : cur));
    },
  });

  return poseForDrawer;
}

export default function GamePlayerRoot({
  game,
  levelIndex = 0,
  deviceId = "web",
  onComplete,
}) {
  const { width, height } = useWindowSize(640, 480);

  const [playId, setPlayId] = useState(null);
  const telemetryRef = useRef(null);

  // Pose data stays in a ref (no re-renders at 30-60fps)
  const poseDataRef = useRef(null);
  const shouldRecordPoseRef = useRef(false);

  // ✅ This is required for your current getPoseData.js (it queries by className)
  // Keep it mounted in DOM always.
  // (We hide it; MediaPipe Camera will attach stream to it.)
  const videoRef = useRef(null);

  // Create play session on mount
  useEffect(() => {
    let cancelled = false;

    async function createPlay() {
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game?.id,
          levelId: game?.levels?.[levelIndex]?.id ?? null,
          deviceId,
        }),
      });

      if (!res.ok) throw new Error(`Failed to create play (${res.status})`);
      const json = await res.json();

      if (!cancelled) setPlayId(json.playId);
    }

    if (game?.id) void createPlay().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [game?.id, levelIndex, deviceId]);

  // Telemetry bus (buffered)
  useEffect(() => {
    if (!playId) return;

    const bus = createTelemetryBus({ playId });
    telemetryRef.current = bus;
    bus.startAutoFlush();

    return () => {
      bus.stopAutoFlush();
      void bus.flushAll();
      telemetryRef.current = null;
    };
  }, [playId]);

  // Session reducer init
  const initialSession = useMemo(() => {
    return createInitialSession({ game, initialLevel: levelIndex, playId: null });
  }, [game, levelIndex]);

  const [session, dispatch] = useReducer(sessionReducer, initialSession);

  // Pose stream hook (video element must be in DOM; your hook finds .input-video)
  const handlePoseData = useCallback((data) => {
    poseDataRef.current = data;
  }, []);

  const { loading, error } = getPoseData({
    width: 640,
    height: 480,
    onPoseData: handlePoseData,
  });

  // Tick loop (drives timers + optional frame recording)
  useRafTick({
    enabled: !session.flags?.paused,
    onTick: ({ now, dt, elapsed }) => {
      dispatch(commands.tick({ now, dt, elapsed }));

      // Pose frame recording (raw; you can add FPS gating later)
      if (shouldRecordPoseRef.current && telemetryRef.current && poseDataRef.current) {
        const pose = poseDataRef.current;
        telemetryRef.current.recordPoseFrame({
          timestamp: Date.now(),
          nodeIndex: session.nodeIndex,
          stateType: normalizeStateType(session.node?.type ?? session.node?.state ?? null),
          poseData: {
            poseLandmarks: pose.poseLandmarks ?? null,
            leftHandLandmarks: pose.leftHandLandmarks ?? null,
            rightHandLandmarks: pose.rightHandLandmarks ?? null,
          },
        });
      }
    },
  });

  // Drain reducer effects (telemetry, completion, pose recording hint)
  useEffect(() => {
    if (!session.effects?.length) return;

    for (const eff of session.effects) {
      if (eff.type === "TELEMETRY_EVENT") {
        const bus = telemetryRef.current;
        if (!bus) continue;
        const evt = eff.event;
        bus.emitEvent(evt.type, { ...evt }, evt.at ?? Date.now());
      }

      if (eff.type === "POSE_RECORDING_HINT") {
        shouldRecordPoseRef.current = !!eff.enabled;
        telemetryRef.current?.emitEvent("POSE_RECORDING_HINT", {
          enabled: !!eff.enabled,
          stateType: eff.stateType,
          nodeIndex: eff.nodeIndex,
        });
      }

      if (eff.type === "ON_COMPLETE") {
        telemetryRef.current?.emitEvent("PLAY_COMPLETE", {
          levelId: session.levelId,
          gameId: session.gameId,
        });
        onComplete?.();
      }
    }

    dispatch(commands.consumeEffects());
  }, [session.effects, session.levelId, session.gameId, onComplete]);

  // PoseCursor click → NEXT (dialogue gating respects cursor delay)
  const handleCursorClick = useCallback(() => {
    const type = normalizeStateType(session.node?.type ?? session.node?.state ?? null);

    if (isDialogueLike(type) && !session.flags?.showCursor) return;

    telemetryRef.current?.emitEvent("CURSOR_CLICK", {
      nodeIndex: session.nodeIndex,
      stateType: type,
    });

    dispatch(commands.next());
  }, [session]);

  const level = game.levels?.[levelIndex];
  const type = normalizeStateType(session.node?.type ?? session.node?.state ?? null);

  // Dialogue line for intro/outro
  const dialogueText = (() => {
    if (!isDialogueLike(type)) return "";
    const lines = session.node?.lines ?? session.node?.dialogues ?? [];
    const line = lines?.[session.dialogueIndex];
    return line?.text ?? line ?? "";
  })();

  const speaker = (() => {
    if (!isDialogueLike(type)) return "";
    const sp = session.node?.speaker;
    return sp?.name ?? sp ?? "";
  })();

  // ✅ live pose for the drawer (updated with RAF)
  const poseForDrawer = usePoseDrawerPose(poseDataRef);

  // Layout: left game area, right pose panel
  const rightPanelWidth = Math.max(260, Math.floor(width * 0.28));
  const leftPanelWidth = width - rightPanelWidth;

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden">
      {/* ✅ Required hidden video element for your current getPoseData implementation */}
      <video
        ref={videoRef}
        className="input-video"
        style={{ display: "none" }}
        playsInline
        muted
      />

      {/* Background */}
      <div className="absolute inset-0">
        {level?.background ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={level.background} alt="" className="w-full h-full object-cover opacity-90" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black" />
        )}
      </div>

      {/* Main layout container */}
      <div className="absolute inset-0 flex">
        {/* LEFT: game visuals / sprites / state UI */}
        <div className="relative h-full" style={{ width: leftPanelWidth }}>
          {/* Non-dialogue state views */}
          <StateRenderer session={session} dispatch={dispatch} poseDataRef={poseDataRef} />

          {/* Dialogue overlay for intro/outro */}
          {isDialogueLike(type) && (
            <div className="absolute bottom-0 left-0 right-0 z-50 bg-black/70 text-white p-6">
              {speaker ? <div className="text-sm text-gray-300 mb-2">{speaker}</div> : null}

              <div
                className="text-lg"
                style={{ fontSize: session.settings?.ui?.dialogueFontSize ?? 20 }}
              >
                {dialogueText}
              </div>

              {session.flags?.showCursor && (
                <div className="mt-4 text-right">
                  <span className="inline-block px-3 py-1 rounded bg-white/10">
                    Click to continue →
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: pose drawer panel */}
        <div
          className="relative h-full border-l border-white/10 bg-black/20"
          style={{ width: rightPanelWidth }}
        >
          <div className="absolute top-0 left-0 right-0 z-10 px-3 py-2 text-xs text-gray-300 bg-black/40">
            Pose View
          </div>

          <div className="absolute inset-0 pt-8">
            <PoseDrawer
              poseData={poseForDrawer}
              width={rightPanelWidth}
              height={height}
              similarityScores={null}
            />
          </div>
        </div>
      </div>

      {/* Pose cursor overlay (global) */}
      <PoseCursor
        poseDataRef={poseDataRef}
        containerWidth={width}
        containerHeight={height}
        onClick={handleCursorClick}
        sensitivity={session.settings?.cursor?.sensitivity ?? 1.5}
      />

      {/* Loading overlay for pose */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/40 z-[60]">
          {error ? `Error: ${String(error)}` : "Loading pose detection..."}
        </div>
      )}
    </div>
  );
}
