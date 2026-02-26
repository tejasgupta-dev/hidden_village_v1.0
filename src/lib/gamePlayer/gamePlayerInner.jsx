"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRafTick } from "@/lib/gamePlayer/runtime/useRafTick";
import { commands } from "@/lib/gamePlayer/session/commands";
import { createInitialSession, sessionReducer } from "@/lib/gamePlayer/session/reducer";
import { createTelemetryBus } from "@/lib/gamePlayer/telemetry/telemetryBus";
import { STATE_TYPES, normalizeStateType } from "@/lib/gamePlayer/states/_shared/stateTypes";

import { createLocalCameraRecorder } from "./telemetry/localCameraRecorder";

import PoseCursor from "@/lib/pose/poseCursor";
import PoseDrawer from "@/lib/pose/poseDrawer";
import usePoseData from "@/lib/hooks/usePoseData";

import StateRenderer from "./stateRenderer";
import PauseUI from "./pauseUI";

function isDialogueLike(type) {
  return type === STATE_TYPES.INTRO || type === STATE_TYPES.OUTRO;
}

// Small helper: derive latest pose for PoseDrawer without storing 60fps pose in React state
function usePoseDrawerPose(poseDataRef) {
  const [poseForDrawer, setPoseForDrawer] = useState(null);

  useRafTick({
    enabled: true,
    onTick: () => {
      const cur = poseDataRef.current ?? null;
      setPoseForDrawer((prev) => (prev === cur ? prev : cur));
    },
  });

  return poseForDrawer;
}

/**
 * Prevent duplicate "startup" telemetry per playId even if GamePlayerInner remounts
 * (e.g., dev StrictMode mount/unmount/mount).
 */
const __startupTelemetrySentForPlay = new Set();

/**
 * Single allowlist for what gets emitted (stored/displayed).
 */
const TELEMETRY_ALLOWED = new Set([
  "SESSION_START",
  "SESSION_END",
  "LEVEL_START",
  "LEVEL_END",

  "STATE_ENTER",
  "STATE_EXIT",

  "PAUSE",
  "RESUME",

  "POSE_MATCH_AUTO_NEXT",
  "POSE_MATCH_CLICK_NEXT",
  "POSE_MATCH_AUTO_FINISH",
  "POSE_MATCH_CLICK_FINISH",
  "POSE_MATCH_REP_FINISH_CLICK",
  "POSE_MATCH_REP_FINISH_AUTO",

  "TRUE_FALSE_SELECTED",
  "INSIGHT_OPTION_SELECTED",
]);

function enrichTelemetryEventWithSession(evt, session) {
  if (!evt || typeof evt !== "object") return evt;

  const isPoseEvt =
    typeof evt.type === "string" &&
    (evt.type.startsWith("POSE_MATCH_") || evt.type.startsWith("POSE_"));

  if (!isPoseEvt) return evt;

  const stepIndex =
    evt.stepIndex ?? (Number.isFinite(Number(session?.stepIndex)) ? session.stepIndex : null);
  const targetPoseId = evt.targetPoseId ?? session?.poseMatch?.targetPoseId ?? null;

  const repIndex =
    evt.repIndex ??
    (normalizeStateType(session?.node?.type ?? session?.node?.state ?? null) === STATE_TYPES.POSE_MATCH
      ? Number(session?.poseMatchRoundIndex ?? 0) || 0
      : 0);

  const levelIndex = Number.isFinite(Number(evt.levelIndex))
    ? evt.levelIndex
    : Number.isFinite(Number(session?.levelIndex))
    ? session.levelIndex
    : null;

  const levelId = evt.levelId ?? session?.levelId ?? null;

  return { ...evt, stepIndex, targetPoseId, repIndex, levelIndex, levelId };
}

function buildPoseFrameContext(session) {
  const stateType = normalizeStateType(session?.node?.type ?? session?.node?.state ?? null);
  const nodeIndex = Number.isFinite(Number(session?.nodeIndex)) ? session.nodeIndex : null;

  const levelIndex = Number.isFinite(Number(session?.levelIndex)) ? session.levelIndex : null;
  const levelId = session?.levelId ?? null;

  const repIndex =
    stateType === STATE_TYPES.POSE_MATCH
      ? Number.isFinite(Number(session?.poseMatchRoundIndex))
        ? Math.max(0, Math.trunc(Number(session.poseMatchRoundIndex)))
        : 0
      : 0;

  const stepIndex =
    stateType === STATE_TYPES.POSE_MATCH
      ? Number.isFinite(Number(session?.stepIndex))
        ? Math.max(0, Math.trunc(Number(session.stepIndex)))
        : null
      : null;

  const targetPoseId =
    stateType === STATE_TYPES.POSE_MATCH ? session?.poseMatch?.targetPoseId ?? null : null;

  return { stateType, nodeIndex, levelIndex, levelId, repIndex, stepIndex, targetPoseId };
}

export default function GamePlayerInner({
  game,
  levelIndex,
  deviceId, // kept for signature compat
  playId,
  onComplete,
  width,
  height,
}) {
  const telemetryRef = useRef(null);

  // Pose data stays in a ref (no re-renders at 30-60fps)
  const poseDataRef = useRef(null);
  const shouldRecordPoseRef = useRef(false);

  // Local seq so server can aggregate ranges by seq
  const poseSeqRef = useRef(0);

  // Required hidden video element for usePoseData
  const videoRef = useRef(null);

  // Local camera+mic recorder (hidden preview)
  const cameraPreviewRef = useRef(null);
  const cameraRecorderRef = useRef(null);
  const startedCameraRef = useRef(false);

  // To avoid emitting ON_COMPLETE logic twice
  const sessionEndedRef = useRef(false);

  // Telemetry bus — guaranteed to use the real playId
  useEffect(() => {
    const bus = createTelemetryBus({ playId });
    telemetryRef.current = bus;
    bus.startAutoFlush();

    return () => {
      bus.stopAutoFlush();
      void bus.flushAll();
      telemetryRef.current = null;
    };
  }, [playId]);

  // Create camera recorder when playId exists
  useEffect(() => {
    if (!playId) return;

    cameraRecorderRef.current = createLocalCameraRecorder({
      playId,
      previewVideoEl: cameraPreviewRef.current,
      videoConstraints: { width: 1280, height: 720, frameRate: 30, facingMode: "user" },
      audioConstraints: true,
    });

    return () => {
      cameraRecorderRef.current?.stop?.({ download: true }).catch?.(() => {});
      cameraRecorderRef.current = null;
      startedCameraRef.current = false;
    };
  }, [playId]);

  // Session reducer init uses real playId
  const initialSession = useMemo(() => {
    return createInitialSession({ game, initialLevel: levelIndex, playId });
  }, [game, levelIndex, playId]);

  const [session, dispatch] = useReducer(sessionReducer, initialSession);

  // Pose stream hook
  const handlePoseData = useCallback((data) => {
    poseDataRef.current = data;
  }, []);

  const { loading, error } = usePoseData({
    videoRef,
    width: 640,
    height: 480,
    onPoseData: handlePoseData,
  });

  // Tick loop (drives timers + optional frame recording)
  useRafTick({
    enabled: !session.flags?.paused,
    onTick: ({ now, dt, elapsed }) => {
      dispatch(commands.tick({ now, dt, elapsed }));

      const bus = telemetryRef.current;
      const pose = poseDataRef.current;

      if (shouldRecordPoseRef.current && bus && pose) {
        const ctx = buildPoseFrameContext(session);
        const seq = poseSeqRef.current++;
        const ts = Date.now();

        bus.recordPoseFrame({
          frameType: "POSE",
          seq,
          timestamp: ts,

          // separation keys (frame stream)
          gameId: game?.id ?? null,
          playId,
          levelId: ctx.levelId ?? null,
          levelIndex: ctx.levelIndex ?? null,
          repIndex: ctx.repIndex ?? 0,

          nodeIndex: ctx.nodeIndex ?? null,
          stateType: ctx.stateType ?? null,

          stepIndex: ctx.stepIndex ?? null,
          targetPoseId: ctx.targetPoseId ?? null,

          poseData: pose ?? null,
        });
      }
    },
  });

  // Drain reducer effects (telemetry, completion, pose recording hint)
  useEffect(() => {
    if (!session.effects?.length) return;

    const bus = telemetryRef.current;
    if (!bus) {
      dispatch(commands.consumeEffects());
      return;
    }

    const startupAlreadySent = __startupTelemetrySentForPlay.has(playId);
    if (!startupAlreadySent) __startupTelemetrySentForPlay.add(playId);

    for (const eff of session.effects) {
      if (eff.type === "TELEMETRY_EVENT") {
        let evt = eff.event;

        // Start camera recording once, at first real STATE_ENTER
        if (!startedCameraRef.current && evt?.type === "STATE_ENTER") {
          startedCameraRef.current = true;
          cameraRecorderRef.current?.start?.().catch((e) => {
            console.error("Camera recorder start failed:", e);
          });
        }

        const isInitEnter =
          evt?.type === "STATE_ENTER" &&
          evt?.nodeIndex === 0 &&
          (evt?.reason === "INIT" || evt?.reason === "INIT_MOUNT" || evt?.reason === "INIT_SESSION");

        if (startupAlreadySent && (evt?.type === "SESSION_START" || isInitEnter)) continue;

        if (!evt?.type || !TELEMETRY_ALLOWED.has(evt.type)) continue;

        evt = enrichTelemetryEventWithSession(evt, session);

        const { type, at, ...payload } = evt || {};
        bus.emitEvent(type, { ...payload, playId }, at ?? Date.now());
        continue;
      }

      if (eff.type === "POSE_RECORDING_HINT") {
        shouldRecordPoseRef.current = !!eff.enabled;
        continue;
      }

      if (eff.type === "ON_COMPLETE") {
        if (!sessionEndedRef.current) {
          sessionEndedRef.current = true;
          cameraRecorderRef.current?.stopAndDownload?.().catch(() => {});
          onComplete?.();
        }
        continue;
      }
    }

    dispatch(commands.consumeEffects());
  }, [session.effects, onComplete, playId, session]);

  const type = normalizeStateType(session.node?.type ?? session.node?.state ?? null);

  // live pose for the drawer (overlay, but no box)
  const poseForDrawer = usePoseDrawerPose(poseDataRef);

  // Dialogue overlay (for intro/outro)
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

  // Similarity overlays only during POSE_MATCH
  const similarityScores =
    type === STATE_TYPES.POSE_MATCH ? session.poseMatch?.perSegment ?? [] : [];

  // ✅ "normal" pose size
  const poseW = 320;
  const poseH = 320;

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden">
      {/* Hidden video used for mediapipe pose detection */}
      <video ref={videoRef} className="input-video" style={{ display: "none" }} playsInline muted />

      {/* Hidden preview used for camera+mic recording */}
      <video ref={cameraPreviewRef} style={{ display: "none" }} playsInline muted />

      {/* ✅ Common background (public/assets/bg.jpg) */}
      <div className="absolute inset-0">
        <img src="/assets/bg.jpg" alt="" className="w-full h-full object-cover opacity-90" />
      </div>

      {/* ✅ Main game (full width) */}
      <div className="absolute inset-0">
        <StateRenderer
          session={session}
          dispatch={dispatch}
          poseDataRef={poseDataRef}
          width={width}
          height={height}
          dialogueText={dialogueText}
          speaker={speaker}
        />
      </div>

      {/* ✅ Pose on the right, vertically centered (slightly below center), no box/background */}
      <div
        className="absolute right-6 z-[55] pointer-events-none"
        style={{
          top: "55%",
          transform: "translateY(-50%)",
        }}
      >
        <PoseDrawer
          poseData={poseForDrawer}
          width={poseW}
          height={poseH}
          similarityScores={similarityScores}
        />
      </div>

      {/* Pose cursor overlay */}
      <PoseCursor
        poseDataRef={poseDataRef}
        containerWidth={width}
        containerHeight={height}
        sensitivity={session.settings?.cursor?.sensitivity ?? 1.5}
      />

      <PauseUI
        session={session}
        dispatch={dispatch}
        onBackToMenu={() => {
          cameraRecorderRef.current?.stopAndDownload?.().catch(() => {});
          onComplete?.();
        }}
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