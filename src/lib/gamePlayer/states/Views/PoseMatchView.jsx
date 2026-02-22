// src/lib/gamePlayer/states/poseMatchView.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";
import PoseDrawer from "@/lib/pose/poseDrawer";
import { enrichLandmarks } from "@/lib/pose/landmark";
import { clampPct } from "@/lib/pose/poseMatching";
import { computePoseMatch, perFeatureToPerSegment } from "@/lib/pose/poseMatching";

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

function nowMS() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Feature IDs come directly from FEATURE_REGISTRY in poseMatching.js
 */
const FEATURES_BY_GROUP = {
  face: [
    "FACE_EYES_NOSE",
    "FACE_MOUTH_NOSE",
    "FACE_MOUTH_CHIN",
    "FACE_NOSE_CHIN_FOREHEAD",
    "FACE_EYE_LINE_TO_MOUTH_LINE",
  ],

  leftArm: ["POSE_LEFT_ELBOW", "POSE_LEFT_SHOULDER", "POSE_LEFT_ARM_BEND"],
  rightArm: ["POSE_RIGHT_ELBOW", "POSE_RIGHT_SHOULDER", "POSE_RIGHT_ARM_BEND"],
  leftLeg: ["POSE_LEFT_HIP", "POSE_LEFT_KNEE"],
  rightLeg: ["POSE_RIGHT_HIP", "POSE_RIGHT_KNEE"],

  hands: [
    // LH_
    "LH_THUMB_CMC",
    "LH_THUMB_MCP",
    "LH_THUMB_IP",
    "LH_INDEX_MCP",
    "LH_INDEX_PIP",
    "LH_INDEX_DIP",
    "LH_MIDDLE_MCP",
    "LH_MIDDLE_PIP",
    "LH_MIDDLE_DIP",
    "LH_RING_MCP",
    "LH_RING_PIP",
    "LH_RING_DIP",
    "LH_PINKY_MCP",
    "LH_PINKY_PIP",
    "LH_PINKY_DIP",
    "LH_INDEX_MIDDLE_SPREAD",
    "LH_MIDDLE_RING_SPREAD",
    "LH_RING_PINKY_SPREAD",

    // RH_
    "RH_THUMB_CMC",
    "RH_THUMB_MCP",
    "RH_THUMB_IP",
    "RH_INDEX_MCP",
    "RH_INDEX_PIP",
    "RH_INDEX_DIP",
    "RH_MIDDLE_MCP",
    "RH_MIDDLE_PIP",
    "RH_MIDDLE_DIP",
    "RH_RING_MCP",
    "RH_RING_PIP",
    "RH_RING_DIP",
    "RH_PINKY_MCP",
    "RH_PINKY_PIP",
    "RH_PINKY_DIP",
    "RH_INDEX_MIDDLE_SPREAD",
    "RH_MIDDLE_RING_SPREAD",
    "RH_RING_PINKY_SPREAD",
  ],
};

function buildFeatureAllowListFromInclude(include) {
  // include shape: { face,leftArm,rightArm,leftLeg,rightLeg,hands } booleans
  if (!include || typeof include !== "object") return null; // null => use all

  const enabledGroups = Object.entries(include)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  // ✅ all off => NO features selected => computePoseMatch returns overall 100
  if (enabledGroups.length === 0) return [];

  const ids = enabledGroups.flatMap((g) => FEATURES_BY_GROUP[g] ?? []);
  return Array.from(new Set(ids));
}

function hasFaceLandmarks(poseObj) {
  const arr = poseObj?.faceLandmarks;
  return Array.isArray(arr) && arr.length > 0;
}

export default function PoseMatchView({ session, node, dispatch, poseDataRef, width = 800, height = 600 }) {
  const minHoldMS = Math.max(0, Number(node?.minHoldMS ?? 5000));

  const level = useMemo(() => session?.game?.levels?.[session?.levelIndex] ?? null, [session?.game, session?.levelIndex]);

  const poseMap = useMemo(() => {
    const poses = level?.poses ?? null;
    return poses && typeof poses === "object" ? poses : null;
  }, [level]);

  const poseIds = useMemo(() => (Array.isArray(node?.poseIds) ? node.poseIds : []), [node?.poseIds]);

  const stepIndex = session?.stepIndex ?? 0;
  const targetPoseId = poseIds[stepIndex] ?? null;

  const targetPose = useMemo(() => {
    if (!poseMap || !targetPoseId) return null;
    return safeParsePose(poseMap[targetPoseId]);
  }, [poseMap, targetPoseId]);

  const thresholdPct = useMemo(() => {
    const arr = Array.isArray(node?.poseTolerances) ? node.poseTolerances : null;
    const fromArray = arr && stepIndex >= 0 && stepIndex < arr.length ? arr[stepIndex] : undefined;
    if (fromArray !== undefined && fromArray !== null && fromArray !== "") return clampPct(fromArray, 70);

    const map = level?.poseTolerancePctById;
    if (map && typeof map === "object" && targetPoseId) {
      const fromMap = map[targetPoseId];
      if (fromMap !== undefined && fromMap !== null && fromMap !== "") return clampPct(fromMap, 70);
    }

    const nodeDefault = node?.defaultTolerance ?? node?.threshold;
    if (nodeDefault !== undefined && nodeDefault !== null && nodeDefault !== "") return clampPct(nodeDefault, 70);

    const poseSpecific = targetPose?.tolerancePct ?? targetPose?.tolerance ?? targetPose?.threshold;
    if (poseSpecific !== undefined && poseSpecific !== null && poseSpecific !== "") return clampPct(poseSpecific, 70);

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
    const t = setInterval(() => setHoldElapsed(nowMS() - stepStartRef.current), 100);
    return () => clearInterval(t);
  }, []);

  const holdRemaining = Math.max(0, minHoldMS - holdElapsed);
  const holdDone = holdElapsed >= minHoldMS;

  /* ----------------------------- include -> feature allowlist ----------------------------- */

  const includeMask = session?.settings?.include ?? null;
  const featureAllowList = useMemo(() => buildFeatureAllowListFromInclude(includeMask), [includeMask]);

  const faceEnabled = includeMask?.face === true;

  /* ----------------------------- face missing gate (pause) ----------------------------- */

  const pausedForFaceRef = useRef(false);
  const [faceMissing, setFaceMissing] = useState(false);

  useEffect(() => {
    // re-evaluate per step
    pausedForFaceRef.current = false;
    setFaceMissing(false);
  }, [session.nodeIndex, stepIndex, targetPoseId]);

  /* ----------------------------- similarity compute ----------------------------- */

  useEffect(() => {
    let cancelled = false;

    const timer = setInterval(() => {
      if (cancelled) return;

      const live = poseDataRef?.current ?? null;

      if (!live || !targetPose) {
        dispatch({
          type: "COMMAND",
          name: "POSE_MATCH_SCORES",
          payload: { overall: 0, perSegment: [], thresholdPct, targetPoseId, stepIndex },
        });
        return;
      }

      // ✅ You requested: FaceMesh only for face.
      // If face is enabled but missing on either live or target, pause.
      if (faceEnabled) {
        const liveHasFace = hasFaceLandmarks(live);
        const targetHasFace = hasFaceLandmarks(targetPose);

        if (!liveHasFace || !targetHasFace) {
          setFaceMissing(true);

          // pause once
          if (!pausedForFaceRef.current) {
            pausedForFaceRef.current = true;
            dispatch(commands.pause());
          }

          // keep scores at 0 while blocked
          dispatch({
            type: "COMMAND",
            name: "POSE_MATCH_SCORES",
            payload: { overall: 0, perSegment: [], thresholdPct, targetPoseId, stepIndex },
          });

          return;
        }
      }

      setFaceMissing(false);

      const enrichedLive = enrichLandmarks(live);
      const enrichedTarget = enrichLandmarks(targetPose);

      const result = computePoseMatch({
        livePose: enrichedLive,
        targetPose: enrichedTarget,
        thresholdPct,
        featureIds: featureAllowList, // null => all, [] => none (overall 100), allowlist => filtered
      });

      const perSegment = perFeatureToPerSegment(result.perFeature);

      dispatch({
        type: "COMMAND",
        name: "POSE_MATCH_SCORES",
        payload: {
          overall: result.overall,
          perSegment,
          perFeature: result.perFeature,
          thresholdPct: result.thresholdPct,
          targetPoseId,
          stepIndex,
        },
      });
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [poseDataRef, targetPose, dispatch, thresholdPct, targetPoseId, stepIndex, featureAllowList, faceEnabled]);

  /* ----------------------------- reducer truth ----------------------------- */

  const overall = Number(session.poseMatch?.overall ?? 0);
  const matched = !!session.poseMatch?.matched;
  const effectiveThreshold = Number(session.poseMatch?.thresholdPct ?? thresholdPct);

  const drawerScores = Array.isArray(session.poseMatch?.perSegment) ? session.poseMatch.perSegment : [];

  /* ----------------------------- advancing ----------------------------- */

  const didAutoAdvanceRef = useRef(false);
  useEffect(() => {
    didAutoAdvanceRef.current = false;
  }, [session.nodeIndex, stepIndex, targetPoseId]);

  useEffect(() => {
    if (faceMissing) return; // blocked
    if (!targetPoseId) return;
    if (!holdDone) return;
    if (!matched) return;

    if (didAutoAdvanceRef.current) return;
    didAutoAdvanceRef.current = true;

    dispatch(commands.next({ source: "auto" }));
  }, [faceMissing, targetPoseId, holdDone, matched, dispatch]);

  const onNext = () => {
    if (faceMissing) return; // blocked
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
              <div className="text-white/95 leading-relaxed" style={{ fontSize: session.settings?.ui?.dialogueFontSize ?? 22 }}>
                {targetPoseId ? "Match the target pose." : "No pose targets found."}
              </div>

              <div className="mt-3 text-sm text-white/50">
                Target: {targetPoseId ?? "—"} | Step {Math.min(stepIndex + 1, poseIds.length)} / {poseIds.length} | Tolerance:{" "}
                {effectiveThreshold.toFixed(0)}%
              </div>

              <div className="mt-3 text-sm text-white/80">
                Similarity: <span className="font-mono">{overall.toFixed(1)}%</span>{" "}
                {matched ? <span className="text-green-300">(matched)</span> : <span className="text-yellow-300">(keep trying)</span>}
              </div>

              {faceMissing ? (
                <div className="mt-2 text-xs text-red-200">
                  Face matching is enabled, but FaceMesh landmarks are missing (live or target). Game is paused.
                </div>
              ) : (
                <div className="mt-2 text-xs text-white/50">
                  {!holdDone
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
                  disabled={!holdDone || faceMissing}
                  onClick={onNext}
                  className={[
                    "next-button",
                    "px-12 py-6 min-w-[220px]",
                    "rounded-3xl font-semibold text-xl",
                    "ring-2 ring-white/30",
                    "transition-all duration-150",
                    holdDone && !faceMissing
                      ? "bg-white/25 text-white hover:bg-white/35"
                      : "bg-white/5 text-white/40 cursor-not-allowed",
                  ].join(" ")}
                  title={faceMissing ? "FaceMesh missing" : !holdDone ? "Wait for the hold timer" : "Advance"}
                >
                  Next →
                </button>
              </div>

              <div className="text-xs text-white/50">
                {faceMissing ? "FaceMesh required." : !holdDone ? "Please wait…" : "Click Next to advance anytime"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}