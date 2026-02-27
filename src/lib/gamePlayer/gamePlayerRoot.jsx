"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRafTick } from "@/lib/gamePlayer/runtime/useRafTick";
import { useWindowSize } from "@/lib/gamePlayer/runtime/useWindowSize";
import { commands } from "@/lib/gamePlayer/session/commands";
import { createInitialSession, sessionReducer } from "@/lib/gamePlayer/session/reducer";
import { createTelemetryBus } from "@/lib/gamePlayer/telemetry/telemetryBus";
import { STATE_TYPES, normalizeStateType } from "@/lib/gamePlayer/states/_shared/stateTypes";

import { createLocalCameraRecorder } from "./telemetry/localCameraRecorder";

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
      const cur = poseDataRef.current ?? null;
      setPoseForDrawer((prev) => (prev === cur ? prev : cur));
    },
  });

  return poseForDrawer;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
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

export default function GamePlayerRoot({
  game,
  levelIndex = 0,
  deviceId = "web",
  onComplete,
}) {
  const { width, height } = useWindowSize(640, 480);

  const gameId = game?.id ?? null;
  const initialLevelId = game?.levels?.[levelIndex]?.id ?? null;

  const [playId, setPlayId] = useState(null);
  const [creatingPlay, setCreatingPlay] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Prevent accidental double create in dev StrictMode
  const createdOnceRef = useRef(false);

  const createPlay = useCallback(async () => {
    if (!gameId || !initialLevelId) return;

    setCreatingPlay(true);
    setCreateError(null);

    const maxAttempts = 6;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await fetch("/api/plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ gameId, levelId: initialLevelId, deviceId }),
        });

        if (res.ok) {
          const json = await res.json();
          setPlayId(json.playId);
          setCreatingPlay(false);
          return;
        }

        const text = await res.text().catch(() => "");
        const msg = `Failed to create play (${res.status}): ${text}`;

        if ((res.status === 401 || res.status === 403) && attempt < maxAttempts) {
          await sleep(250 * attempt);
          continue;
        }

        throw new Error(msg);
      }
    } catch (e) {
      setCreateError(e?.message ?? String(e));
      setCreatingPlay(false);
    }
  }, [gameId, initialLevelId, deviceId]);

  // Create play on mount (once), only after initialLevelId exists
  useEffect(() => {
    if (!gameId || !initialLevelId) return;
    if (playId) return;

    if (createdOnceRef.current) return;
    createdOnceRef.current = true;

    void createPlay();
  }, [gameId, initialLevelId, playId, createPlay]);

  if (!gameId || !initialLevelId) {
    return (
      <div className="w-full h-screen bg-gray-950 text-white flex items-center justify-center">
        Preparing game…
      </div>
    );
  }

  if (!playId) {
    return (
      <div className="w-full h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-lg">{creatingPlay ? "Creating play…" : "Preparing…"}</div>

        {createError ? (
          <div className="max-w-xl text-sm text-red-200 bg-red-900/30 ring-1 ring-red-500/30 rounded-xl p-3">
            {createError}
          </div>
        ) : (
          <div className="text-sm text-white/60">Waiting for session + creating play…</div>
        )}

        <button
          type="button"
          onClick={() => {
            createdOnceRef.current = true;
            void createPlay();
          }}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 ring-1 ring-white/20"
          disabled={creatingPlay}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <GamePlayerInner
      game={game}
      levelIndex={levelIndex}
      deviceId={deviceId}
      playId={playId}
      onComplete={onComplete}
      width={width}
      height={height}
    />
  );
}

function GamePlayerInner({
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

  // Required hidden video element for getPoseData
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

  const { loading, error } = getPoseData({
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
          cameraRecorderRef.current
            ?.start?.()
            .catch((e) => console.error("Camera recorder start failed:", e));
        }

        const isInitEnter =
          evt?.type === "STATE_ENTER" &&
          evt?.nodeIndex === 0 &&
          (evt?.reason === "INIT" || evt?.reason === "INIT_MOUNT" || evt?.reason === "INIT_SESSION");

        if (startupAlreadySent && (evt?.type === "SESSION_START" || isInitEnter)) {
          continue;
        }

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

  // IMPORTANT: use session.levelIndex (because reducer now advances levels)
  const activeLevelIndex = Number.isFinite(Number(session?.levelIndex)) ? session.levelIndex : levelIndex;
  const level = game.levels?.[activeLevelIndex];

  const type = normalizeStateType(session.node?.type ?? session.node?.state ?? null);

  // live pose for the drawer
  const poseForDrawer = usePoseDrawerPose(poseDataRef);

  // Layout sizes
  const rightPanelWidth = Math.max(260, Math.floor(width * 0.28));
  const leftPanelWidth = width - rightPanelWidth;

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
  const rightSimilarityScores =
    type === STATE_TYPES.POSE_MATCH ? session.poseMatch?.perSegment ?? [] : [];

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden">
      {/* Hidden video used for mediapipe pose detection */}
      <video ref={videoRef} className="input-video" style={{ display: "none" }} playsInline muted />

      {/* Hidden preview used for camera+mic recording */}
      <video ref={cameraPreviewRef} style={{ display: "none" }} playsInline muted />

      {/* Background */}
      <div className="absolute inset-0">
        {level?.background ? (
          <img src={level.background} alt="" className="w-full h-full object-cover opacity-90" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black" />
        )}
      </div>

      <div className="absolute inset-0 flex">
        {/* LEFT */}
        <div className="relative h-full" style={{ width: leftPanelWidth }}>
          <StateRenderer
            session={session}
            dispatch={dispatch}
            poseDataRef={poseDataRef}
            width={leftPanelWidth}
            height={height}
            game={game}
          />
        </div>

        {/* RIGHT */}
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
              similarityScores={rightSimilarityScores}
            />
          </div>
        </div>
      </div>

      {/* Pose cursor overlay */}
      <PoseCursor
        poseDataRef={poseDataRef}
        containerWidth={width}
        containerHeight={height}
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