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
 * ✅ Prevent duplicate "startup" telemetry per playId even if GamePlayerInner remounts
 * (e.g., dev StrictMode mount/unmount/mount).
 *
 * Module scope survives remounts within the same tab session.
 */
const __startupTelemetrySentForPlay = new Set();

export default function GamePlayerRoot({
  game,
  levelIndex = 0,
  deviceId = "web",
  onComplete,
}) {
  const { width, height } = useWindowSize(640, 480);

  const gameId = game?.id ?? null;
  const levelId = game?.levels?.[levelIndex]?.id ?? null;

  const [playId, setPlayId] = useState(null);
  const [creatingPlay, setCreatingPlay] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Prevent accidental double create in dev StrictMode
  const createdOnceRef = useRef(false);

  const createPlay = useCallback(async () => {
    if (!gameId || !levelId) return;

    setCreatingPlay(true);
    setCreateError(null);

    const maxAttempts = 6;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await fetch("/api/plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            gameId,
            levelId,
            deviceId,
          }),
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
  }, [gameId, levelId, deviceId]);

  // Create play on mount (once), only after levelId exists
  useEffect(() => {
    if (!gameId || !levelId) return;
    if (playId) return;

    if (createdOnceRef.current) return;
    createdOnceRef.current = true;

    void createPlay();
  }, [gameId, levelId, playId, createPlay]);

  if (!gameId || !levelId) {
    return (
      <div className="w-full h-screen bg-gray-950 text-white flex items-center justify-center">
        Preparing level…
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
  deviceId,
  playId,
  onComplete,
  width,
  height,
}) {
  const telemetryRef = useRef(null);

  // Pose data stays in a ref (no re-renders at 30-60fps)
  const poseDataRef = useRef(null);
  const shouldRecordPoseRef = useRef(false);

  // Required hidden video element for getPoseData
  const videoRef = useRef(null);

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

  // Session reducer init uses real playId (so SESSION_START is correct)
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

      if (shouldRecordPoseRef.current && telemetryRef.current && poseDataRef.current) {
        const pose = poseDataRef.current;
        telemetryRef.current.recordPoseFrame({
          timestamp: Date.now(),
          playId,
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

    const bus = telemetryRef.current;
    if (!bus) {
      dispatch(commands.consumeEffects());
      return;
    }

    // ✅ Only allow the startup trio once per playId (prevents "page reload" double fire)
    const startupAlreadySent = __startupTelemetrySentForPlay.has(playId);
    if (!startupAlreadySent) {
      __startupTelemetrySentForPlay.add(playId);
    }

    for (const eff of session.effects) {
      if (eff.type === "TELEMETRY_EVENT") {
        const evt = eff.event;

        if (startupAlreadySent) {
          if (evt?.type === "SESSION_START" || evt?.type === "STATE_ENTER") {
            continue;
          }
        }

        const { type, at, ...payload } = evt || {};
        bus.emitEvent(type, { ...payload, playId }, at ?? Date.now());
      }

      if (eff.type === "POSE_RECORDING_HINT") {
        if (startupAlreadySent) continue;

        shouldRecordPoseRef.current = !!eff.enabled;
        bus.emitEvent("POSE_RECORDING_HINT", {
          playId,
          enabled: !!eff.enabled,
          stateType: eff.stateType,
          nodeIndex: eff.nodeIndex,
        });
      }

      if (eff.type === "ON_COMPLETE") {
        bus.emitEvent("PLAY_COMPLETE", {
          playId,
          levelId: session.levelId,
          gameId: session.gameId,
        });
        onComplete?.();
      }
    }

    dispatch(commands.consumeEffects());
  }, [session.effects, session.levelId, session.gameId, onComplete, playId, dispatch]);

  const level = game.levels?.[levelIndex];
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

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden">
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
          <img
            src={level.background}
            alt=""
            className="w-full h-full object-cover opacity-90"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black" />
        )}
      </div>

      <div className="absolute inset-0 flex">
        {/* LEFT */}
        <div className="relative h-full" style={{ width: leftPanelWidth }}>
          <StateRenderer session={session} dispatch={dispatch} poseDataRef={poseDataRef} />
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
              similarityScores={null}
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
