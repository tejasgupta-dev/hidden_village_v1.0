// src/lib/gamePlayer/states/poseMatchView.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRafTick } from "@/lib/gamePlayer/runtime/useRafTick";
import { commands } from "@/lib/gamePlayer/session/commands";
import PoseDrawer from "@/lib/pose/poseDrawer";
import { clampPct, computePoseMatchFrame } from "@/lib/pose/poseMatching";

function DefaultSpeakerSprite() {
  return (
    <div className="h-28 w-28 rounded-3xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
      <div className="h-16 w-16 rounded-full bg-white/15 flex items-center justify-center text-white/80 font-semibold text-xl">
        G
      </div>
    </div>
  );
}

function safeParsePose(maybeJson) {
  if (!maybeJson) return null;
  if (typeof maybeJson === "object") return maybeJson;
  if (typeof maybeJson !== "string") return null;
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

export default function PoseMatchView({
  session,
  node,
  dispatch,
  poseDataRef,
  width = 800,
  height = 600,
}) {
  const paused = !!session?.flags?.paused;

  const minHoldMS = Math.max(0, Number(node?.minHoldMS ?? 2000));

  const level = useMemo(
    () => session?.game?.levels?.[session?.levelIndex] ?? null,
    [session?.game, session?.levelIndex]
  );

  const poseMap = useMemo(() => {
    const poses = level?.poses ?? null;
    return poses && typeof poses === "object" ? poses : null;
  }, [level]);

  const poseIds = useMemo(
    () => (Array.isArray(node?.poseIds) ? node.poseIds : []),
    [node?.poseIds]
  );

  const stepIndex = session?.stepIndex ?? 0;
  const targetPoseId = poseIds[stepIndex] ?? null;

  const targetPose = useMemo(() => {
    if (!poseMap || !targetPoseId) return null;
    return safeParsePose(poseMap[targetPoseId]);
  }, [poseMap, targetPoseId]);

  const thresholdPct = useMemo(() => {
    const arr = Array.isArray(node?.poseTolerances) ? node.poseTolerances : null;
    const fromArray =
      arr && stepIndex >= 0 && stepIndex < arr.length ? arr[stepIndex] : undefined;
    if (fromArray !== undefined && fromArray !== null && fromArray !== "") {
      return clampPct(fromArray, 70);
    }

    const map = level?.poseTolerancePctById;
    if (map && typeof map === "object" && targetPoseId) {
      const fromMap = map[targetPoseId];
      if (fromMap !== undefined && fromMap !== null && fromMap !== "") {
        return clampPct(fromMap, 70);
      }
    }

    const nodeDefault = node?.defaultTolerance ?? node?.threshold;
    if (nodeDefault !== undefined && nodeDefault !== null && nodeDefault !== "") {
      return clampPct(nodeDefault, 70);
    }

    const poseSpecific =
      targetPose?.tolerancePct ?? targetPose?.tolerance ?? targetPose?.threshold;
    if (poseSpecific !== undefined && poseSpecific !== null && poseSpecific !== "") {
      return clampPct(poseSpecific, 70);
    }

    return 70;
  }, [node, stepIndex, level, targetPoseId, targetPose]);

  /* ----------------------------- hold gate (RAF-based) ----------------------------- */

  const holdElapsedRef = useRef(0); // ms
  const [holdElapsed, setHoldElapsed] = useState(0);

  // throttle UI updates so we don't re-render at 60fps
  const uiAccRef = useRef(0);

  const holdRemaining = Math.max(0, minHoldMS - holdElapsed);
  const holdDone = holdElapsed >= minHoldMS;

  /* ----------------------------- compute + dispatch (RAF-based) ----------------------------- */

  const includeMask = session?.settings?.include ?? null;

  const pausedForBlockRef = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState(null);

  // compute only every 100ms (10 Hz)
  const scoreAccRef = useRef(0);
  const SCORE_EVERY_MS = 100;
  const UI_EVERY_MS = 100;

  // reset per-step state
  useEffect(() => {
    holdElapsedRef.current = 0;
    setHoldElapsed(0);
    uiAccRef.current = 0;

    scoreAccRef.current = 0;

    pausedForBlockRef.current = false;
    setBlocked(false);
    setBlockReason(null);
  }, [session.nodeIndex, stepIndex, targetPoseId]);

  useRafTick({
    // ✅ Stops entirely when paused (so no matching + no hold updates + no auto logic from this component)
    enabled: !paused,
    onTick: ({ dt }) => {
      const d = Math.max(0, Number(dt) || 0);

      // Hold timer increments only while NOT paused (since enabled: !paused)
      holdElapsedRef.current += d;

      uiAccRef.current += d;
      if (uiAccRef.current >= UI_EVERY_MS) {
        uiAccRef.current = uiAccRef.current % UI_EVERY_MS;
        setHoldElapsed(holdElapsedRef.current);
      }

      // Pose score compute at 10Hz
      scoreAccRef.current += d;
      if (scoreAccRef.current < SCORE_EVERY_MS) return;
      scoreAccRef.current = scoreAccRef.current % SCORE_EVERY_MS;

      const live = poseDataRef?.current ?? null;

      if (!live || !targetPose) {
        dispatch({
          type: "COMMAND",
          name: "POSE_MATCH_SCORES",
          payload: { overall: 0, perSegment: [], thresholdPct, targetPoseId, stepIndex },
        });
        return;
      }

      const r = computePoseMatchFrame({
        liveRaw: live,
        targetRaw: targetPose,
        include: includeMask,
        thresholdPct,
      });

      setBlocked(!!r.blocked);
      setBlockReason(r.blockReason ?? null);

      if (r.blocked) {
        // Pause once (do not spam)
        if (!pausedForBlockRef.current && !session?.flags?.paused) {
          pausedForBlockRef.current = true;
          dispatch(commands.pause());
        }

        dispatch({
          type: "COMMAND",
          name: "POSE_MATCH_SCORES",
          payload: { overall: 0, perSegment: [], thresholdPct, targetPoseId, stepIndex },
        });
        return;
      }

      dispatch({
        type: "COMMAND",
        name: "POSE_MATCH_SCORES",
        payload: {
          overall: r.overall,
          perSegment: r.perSegment,
          perFeature: r.perFeature,
          thresholdPct: r.thresholdPct,
          targetPoseId,
          stepIndex,
        },
      });
    },
  });

  /* ----------------------------- reducer truth ----------------------------- */

  const overall = Number(session.poseMatch?.overall ?? 0);
  const matched = !!session.poseMatch?.matched;
  const effectiveThreshold = Number(session.poseMatch?.thresholdPct ?? thresholdPct);

  const drawerScores = Array.isArray(session.poseMatch?.perSegment)
    ? session.poseMatch.perSegment
    : [];

  const reps = Number(session?.settings?.reps?.poseMatch ?? 1);
  const roundIndex = Number(session?.poseMatchRoundIndex ?? 0);

  /* ----------------------------- advancing ----------------------------- */

  const didAutoAdvanceRef = useRef(false);
  useEffect(() => {
    didAutoAdvanceRef.current = false;
  }, [session.nodeIndex, stepIndex, targetPoseId, roundIndex]);

  useEffect(() => {
    // ✅ Never auto-advance while paused
    if (paused) return;

    if (blocked) return;
    if (!targetPoseId) return;
    if (!holdDone) return;
    if (!matched) return;

    if (didAutoAdvanceRef.current) return;
    didAutoAdvanceRef.current = true;

    dispatch(commands.next({ source: "auto" }));
  }, [paused, blocked, targetPoseId, holdDone, matched, dispatch]);

  const onNext = () => {
    if (paused) return;
    if (blocked) return;
    if (!holdDone) return;
    dispatch(commands.next({ source: "click" }));
  };

  return (
    <div className="absolute inset-0 z-20 pointer-events-auto">
      <div className="absolute inset-0 bg-black/30" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-3xl bg-black/40 ring-1 ring-white/10 p-4">
          {targetPose ? (
            <PoseDrawer
              poseData={targetPose}
              width={Math.min(520, Math.floor(width * 0.55))}
              height={Math.min(700, Math.floor(height * 0.85))}
              similarityScores={drawerScores}
            />
          ) : (
            <div className="text-white/80 text-sm">No target pose available.</div>
          )}
        </div>
      </div>

      <div className="absolute left-0 right-0 bottom-0 p-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-black/70 ring-1 ring-white/15 backdrop-blur-md p-8">
          <div className="flex gap-8 items-end">
            <div className="shrink-0">
              <DefaultSpeakerSprite />
              <div className="mt-3 text-sm text-white/70 text-center">Pose Match</div>
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="text-white/95 leading-relaxed"
                style={{ fontSize: session.settings?.ui?.dialogueFontSize ?? 22 }}
              >
                {targetPoseId ? "Match the target pose." : "No pose targets found."}
              </div>

              <div className="mt-3 text-sm text-white/50">
                Target: {targetPoseId ?? "—"} | Step {Math.min(stepIndex + 1, poseIds.length)} /{" "}
                {poseIds.length}
                {reps > 1 ? ` | Rep ${Math.min(roundIndex + 1, reps)} / ${reps}` : null}
                {" "} | Tolerance: {effectiveThreshold.toFixed(0)}%
              </div>

              <div className="mt-3 text-sm text-white/80">
                Similarity: <span className="font-mono">{overall.toFixed(1)}%</span>{" "}
                {matched ? (
                  <span className="text-green-300">(matched)</span>
                ) : (
                  <span className="text-yellow-300">(keep trying)</span>
                )}
              </div>

              {blocked ? (
                <div className="mt-2 text-xs text-red-200">
                  {blockReason === "face_missing"
                    ? "Face matching is enabled, but FaceMesh landmarks are missing (live or target). Game is paused."
                    : "Pose matching is blocked. Game is paused."}
                </div>
              ) : (
                <div className="mt-2 text-xs text-white/50">
                  {paused
                    ? "Paused."
                    : !holdDone
                    ? `Please wait: ${Math.ceil(holdRemaining / 1000)}s`
                    : matched
                    ? "Matched — will auto-advance."
                    : "You can match it or click Next to move on."}
                </div>
              )}
            </div>

            <div className="shrink-0 flex flex-col items-end gap-4">
              <div className="p-4">
                <button
                  type="button"
                  disabled={paused || !holdDone || blocked}
                  onClick={onNext}
                  className={[
                    "next-button",
                    "px-12 py-6 min-w-[220px]",
                    "rounded-3xl font-semibold text-xl",
                    "ring-2 ring-white/30",
                    "transition-all duration-150",
                    !paused && holdDone && !blocked
                      ? "bg-white/25 text-white hover:bg-white/35"
                      : "bg-white/5 text-white/40 cursor-not-allowed",
                  ].join(" ")}
                  title={
                    paused
                      ? "Paused"
                      : blocked
                      ? "Blocked"
                      : !holdDone
                      ? "Wait for the hold timer"
                      : "Advance"
                  }
                >
                  Next →
                </button>
              </div>

              <div className="text-xs text-white/50">
                {paused
                  ? "Paused."
                  : blocked
                  ? "Blocked."
                  : !holdDone
                  ? "Please wait…"
                  : "Click Next to advance anytime"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}