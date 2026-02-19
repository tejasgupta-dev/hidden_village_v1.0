"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";
import PoseDrawer from "@/lib/pose/poseDrawer";
import { matchSegmentToLandmarks, segmentSimilarity } from "@/lib/pose/poseDrawerHelper";
import { enrichLandmarks } from "@/lib/pose/landmark";

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

const MATCH_CONFIG = [
  { segment: "RIGHT_BICEP", data: "poseLandmarks" },
  { segment: "RIGHT_FOREARM", data: "poseLandmarks" },
  { segment: "LEFT_BICEP", data: "poseLandmarks" },
  { segment: "LEFT_FOREARM", data: "poseLandmarks" },
];

function nowMS() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

// Accept 0..1 or 0..100; output 0..100
function toPct(value) {
  const t = Number(value);
  if (!Number.isFinite(t)) return null;
  return t <= 1 ? t * 100 : t;
}

function clampPct(v, fallback = 70) {
  const n = toPct(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

export default function PoseMatchView({
  session,
  node,
  dispatch,
  poseDataRef,
  width = 800,
  height = 600,
}) {
  const minHoldMS = Math.max(0, Number(node?.minHoldMS ?? 5000));

  const level = useMemo(() => {
    return session?.game?.levels?.[session?.levelIndex] ?? null;
  }, [session?.game, session?.levelIndex]);

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

  /**
   * ✅ FIXED tolerance priority (0..100):
   * 1) node.poseTolerances[stepIndex]   (your editor mapping)
   * 2) level.poseTolerancePctById[targetPoseId]  (extra safety if mapping missing)
   * 3) node.defaultTolerance || node.threshold
   * 4) pose json tolerance fields (LAST so they can't override editor)
   * 5) fallback 70
   */
  const thresholdPct = useMemo(() => {
    // 1) node.poseTolerances
    const arr = Array.isArray(node?.poseTolerances) ? node.poseTolerances : null;
    const fromArray =
      arr && stepIndex >= 0 && stepIndex < arr.length ? arr[stepIndex] : undefined;
    if (fromArray !== undefined && fromArray !== null && fromArray !== "") {
      return clampPct(fromArray, 70);
    }

    // 2) level.poseTolerancePctById
    const map = level?.poseTolerancePctById;
    if (map && typeof map === "object" && targetPoseId) {
      const fromMap = map[targetPoseId];
      if (fromMap !== undefined && fromMap !== null && fromMap !== "") {
        return clampPct(fromMap, 70);
      }
    }

    // 3) node default
    const nodeDefault = node?.defaultTolerance ?? node?.threshold;
    if (nodeDefault !== undefined && nodeDefault !== null && nodeDefault !== "") {
      return clampPct(nodeDefault, 70);
    }

    // 4) pose json (last)
    const poseSpecific =
      targetPose?.tolerancePct ?? targetPose?.tolerance ?? targetPose?.threshold;
    if (poseSpecific !== undefined && poseSpecific !== null && poseSpecific !== "") {
      return clampPct(poseSpecific, 70);
    }

    return 70;
  }, [node, stepIndex, level, targetPoseId, targetPose]);

  /* ----------------------------- hold gate ----------------------------- */

  const stepStartRef = useRef(nowMS());
  const [holdElapsed, setHoldElapsed] = useState(0);

  useEffect(() => {
    stepStartRef.current = nowMS();
    setHoldElapsed(0);
  }, [session.nodeIndex, stepIndex, targetPoseId]);

  useEffect(() => {
    const t = setInterval(() => {
      setHoldElapsed(nowMS() - stepStartRef.current);
    }, 100);
    return () => clearInterval(t);
  }, []);

  const holdRemaining = Math.max(0, minHoldMS - holdElapsed);
  const holdDone = holdElapsed >= minHoldMS;

  /* ----------------------------- similarity compute ----------------------------- */

  useEffect(() => {
    let cancelled = false;

    const timer = setInterval(() => {
      if (cancelled) return;

      const live = poseDataRef?.current ?? null;

      if (!live?.poseLandmarks || !targetPose?.poseLandmarks) {
        dispatch({
          type: "COMMAND",
          name: "POSE_MATCH_SCORES",
          payload: {
            overall: 0,
            perSegment: [],
            thresholdPct,
            targetPoseId,
            stepIndex,
          },
        });
        return;
      }

      const enrichedLive = enrichLandmarks(live);
      const enrichedTarget = enrichLandmarks(targetPose);

      const perSegment = MATCH_CONFIG.map((cfg) => {
        const playerSeg = matchSegmentToLandmarks(cfg, enrichedLive, { width: 400, height: 600 });
        const modelSeg = matchSegmentToLandmarks(cfg, enrichedTarget, { width: 400, height: 600 });
        const score = playerSeg && modelSeg ? segmentSimilarity(playerSeg, modelSeg) : 0;
        return { segment: cfg.segment, similarityScore: score };
      });

      const valid = perSegment.map((s) => s.similarityScore).filter((v) => Number.isFinite(v));
      const overall = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;

      dispatch({
        type: "COMMAND",
        name: "POSE_MATCH_SCORES",
        payload: { overall, perSegment, thresholdPct, targetPoseId, stepIndex },
      });
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [poseDataRef, targetPose, dispatch, thresholdPct, targetPoseId, stepIndex]);

  /* ----------------------------- reducer truth ----------------------------- */

  const overall = Number(session.poseMatch?.overall ?? 0);
  const matched = !!session.poseMatch?.matched;
  const effectiveThreshold = Number(session.poseMatch?.thresholdPct ?? thresholdPct);

  /* ----------------------------- advancing ----------------------------- */

  const didAutoAdvanceRef = useRef(false);
  useEffect(() => {
    didAutoAdvanceRef.current = false;
  }, [session.nodeIndex, stepIndex, targetPoseId]);

  useEffect(() => {
    if (!targetPoseId) return;
    if (!holdDone) return;
    if (!matched) return;

    if (didAutoAdvanceRef.current) return;
    didAutoAdvanceRef.current = true;

    dispatch(commands.next({ source: "auto" }));
  }, [targetPoseId, holdDone, matched, dispatch]);

  const onNext = () => {
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
              similarityScores={[]}
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
                {poseIds.length} | Tolerance: {effectiveThreshold.toFixed(0)}%
              </div>

              <div className="mt-3 text-sm text-white/80">
                Similarity: <span className="font-mono">{overall.toFixed(1)}%</span>{" "}
                {matched ? (
                  <span className="text-green-300">(matched)</span>
                ) : (
                  <span className="text-yellow-300">(keep trying)</span>
                )}
              </div>

              <div className="mt-2 text-xs text-white/50">
                {!holdDone
                  ? `Please wait: ${Math.ceil(holdRemaining / 1000)}s`
                  : matched
                  ? "Matched — will auto-advance."
                  : "You can match it or click Next to move on."}
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-4">
              <div className="p-4">
                <button
                  type="button"
                  disabled={!holdDone}
                  onClick={onNext}
                  className={[
                    "next-button",
                    "px-12 py-6 min-w-[220px]",
                    "rounded-3xl font-semibold text-xl",
                    "ring-2 ring-white/30",
                    "transition-all duration-150",
                    holdDone
                      ? "bg-white/25 text-white hover:bg-white/35"
                      : "bg-white/5 text-white/40 cursor-not-allowed",
                  ].join(" ")}
                  title={!holdDone ? "Wait for the hold timer" : "Advance"}
                >
                  Next →
                </button>
              </div>

              <div className="text-xs text-white/50">
                {!holdDone ? "Please wait…" : "Click Next to advance anytime"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
