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

function getOrCreateClientPlayId(storageKey) {
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;

    const id =
      (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `play_${Math.random().toString(16).slice(2)}_${Date.now()}`;

    sessionStorage.setItem(storageKey, id);
    return id;
  } catch {
    // If sessionStorage is blocked, still generate a stable-ish id for this mount.
    return `play_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

export default function GamePlayerRoot({
  game,
  levelIndex = 0,
  deviceId = "web",
  onComplete,
}) {
  const { width, height } = useWindowSize(640, 480);

  const [playId, setPlayId] = useState(null);
  const [creatingPlay, setCreatingPlay] = useState(false);

  // Guard against StrictMode double-invoking effects in dev
  const createdOnceRef = useRef(false);

  // Create play session on mount (idempotent via clientPlayId)
  useEffect(() => {
    if (!game?.id) return;
    if (createdOnceRef.current) return;
    createdOnceRef.current = true;

    let cancelled = false;

    async function createPlay() {
      setCreatingPlay(true);

      const levelId = game?.levels?.[levelIndex]?.id ?? null;
      const storageKey = `clientPlayId:${game.id}:${levelId}:${deviceId}`;
      const clientPlayId = getOrCreateClientPlayId(storageKey);

      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          levelId,
          deviceId,
          clientPlayId, // ✅ makes play creation idempotent
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to create play (${res.status}): ${txt}`);
      }

      const json = await res.json();

      if (!cancelled) setPlayId(json.playId);
      setCreatingPlay(false);
    }

    void createPlay().catch((e) => {
      console.error(e);
      setCreatingPlay(false);
    });

    return () => {
      cancelled = true;
    };
  }, [game?.id, game, levelIndex, deviceId]);

  if (!playId) {
    return (
      <div className="w-full h-screen bg-gray-950 text-white flex items-center justify-center">
        {creatingPlay ? "Creating play…" : "Preparing…"}
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

  // Telemetry bus (buffered) — now guaranteed to use real playId
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

  // Session reducer init — now uses real playId, so SESSION_START will be correct
  const initialSession = useMemo(() => {
    return createInitialSession({ game, initialLevel: levelIndex, playId });
  }, [game, levelIndex, playId]);

  const [session, dispatch] = useReducer(sessionReducer, initialSession);

  // Pose stream hook
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

    for (const eff of session.effects) {
      if (eff.type === "TELEMETRY_EVENT") {
        const bus = telemetryRef.current;
        if (!bus) continue;
        const evt = eff.event;
        bus.emitEvent(evt.type, { ...evt, playId }, evt.at ?? Date.now());
      }

      if (eff.type === "POSE_RECORDING_HINT") {
        shouldRecordPoseRef.current = !!eff.enabled;
        telemetryRef.current?.emitEvent("POSE_RECORDING_HINT", {
          playId,
          enabled: !!eff.enabled,
          stateType: eff.stateType,
          nodeIndex: eff.nodeIndex,
        });
      }

      if (eff.type === "ON_COMPLETE") {
        telemetryRef.current?.emitEvent("PLAY_COMPLETE", {
          playId,
          levelId: session.levelId,
          gameId: session.gameId,
        });
        onComplete?.();
      }
    }

    dispatch(commands.consumeEffects());
  }, [session.effects, session.levelId, session.gameId, onComplete, playId]);

  // PoseCursor click → NEXT
  const handleCursorClick = useCallback(() => {
    const type = normalizeStateType(session.node?.type ?? session.node?.state ?? null);
    if (isDialogueLike(type) && !session.flags?.showCursor) return;

    telemetryRef.current?.emitEvent("CURSOR_CLICK", {
      playId,
      nodeIndex: session.nodeIndex,
      stateType: type,
    });

    dispatch(commands.next());
  }, [session, playId]);

  const level = game.levels?.[levelIndex];
  const type = normalizeStateType(session.node?.type ?? session.node?.state ?? null);

  // live pose for the drawer (updated with RAF)
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={level.background} alt="" className="w-full h-full object-cover opacity-90" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black" />
        )}
      </div>

      <div className="absolute inset-0 flex">
        {/* LEFT */}
        <div className="relative h-full" style={{ width: leftPanelWidth }}>
          <StateRenderer session={session} dispatch={dispatch} poseDataRef={poseDataRef} />

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
        onClick={handleCursorClick}
        sensitivity={session.settings?.cursor?.sensitivity ?? 1.5}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/40 z-[60]">
          {error ? `Error: ${String(error)}` : "Loading pose detection..."}
        </div>
      )}
    </div>
  );
}
