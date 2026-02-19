"use client";

import { useMemo, useState } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";

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

export default function PoseMatchView({ session, node, dispatch, poseDataRef, width = 800, height = 600 }) {
  const threshold = node?.threshold ?? 0.85;
  const showCursor = !!session?.flags?.showCursor;
  const [lastScore, setLastScore] = useState(null);

  const poseMap = useMemo(() => {
    const level = session?.game?.levels?.[session?.levelIndex] ?? null;
    const poses = level?.poses ?? null;
    return poses && typeof poses === "object" ? poses : null;
  }, [session?.game, session?.levelIndex]);

  const poseIds = useMemo(() => {
    return Array.isArray(node?.poseIds) ? node.poseIds : [];
  }, [node?.poseIds]);

  const stepIndex = session?.stepIndex ?? 0;
  const targetPoseId = poseIds[stepIndex] ?? null;

  const targetPose = useMemo(() => {
    if (!poseMap || !targetPoseId) return null;
    return safeParsePose(poseMap[targetPoseId]);
  }, [poseMap, targetPoseId]);

  // Placeholder score (replace with real matcher later)
  const score = useMemo(() => {
    const hasPose = !!poseDataRef?.current?.poseLandmarks;
    return hasPose ? 0.9 : 0.0;
  }, [poseDataRef?.current]);

  const matched = score >= threshold;

  const onNext = () => dispatch(commands.next());

  return (
    <div className="absolute inset-0 z-20 pointer-events-auto">
      <div className="absolute inset-0 bg-black/30" />

      {/* Main content area (optional space for drawing target pose etc.) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* You can render targetPose in PoseDrawer here if you want */}
        {!targetPoseId ? (
          <div className="text-white/80 text-sm">No target pose available.</div>
        ) : (
          <div className="text-white/80 text-sm">
            Target pose: <span className="font-mono">{targetPoseId}</span>
          </div>
        )}
      </div>

      {/* Bottom bar exactly like Intro */}
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
                Target: {targetPoseId ?? "—"} | Step {Math.min(stepIndex + 1, poseIds.length)} / {poseIds.length} | Threshold: {threshold}
              </div>

              <div className="mt-3 text-sm text-white/80">
                Current score: <span className="font-mono">{score.toFixed(2)}</span>{" "}
                {matched ? (
                  <span className="text-green-300">(matched)</span>
                ) : (
                  <span className="text-yellow-300">(keep trying)</span>
                )}
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  className="px-4 py-2 rounded bg-white text-black hover:bg-gray-200"
                  onClick={() => {
                    const payload = { score, matched, threshold, targetPoseId };
                    setLastScore(score);
                    dispatch({ type: "COMMAND", name: "POSE_MATCH_RESULT", payload });
                    if (matched) dispatch(commands.next());
                  }}
                >
                  Submit / Check
                </button>

                <button
                  className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
                  onClick={onNext}
                >
                  Continue
                </button>

                {lastScore != null && (
                  <div className="ml-auto text-xs text-white/50 self-center">
                    last submitted: {lastScore.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-4">
              <div className="p-4">
                <button
                  type="button"
                  disabled={!showCursor}
                  onClick={onNext}
                  className={[
                    "next-button",
                    "px-12 py-6 min-w-[220px]",
                    "rounded-3xl font-semibold text-xl",
                    "ring-2 ring-white/30",
                    "transition-all duration-150",
                    showCursor
                      ? "bg-white/25 text-white hover:bg-white/35"
                      : "bg-white/5 text-white/40 cursor-not-allowed",
                  ].join(" ")}
                >
                  Next →
                </button>
              </div>

              <div className="text-xs text-white/50">
                {showCursor ? "Click or hover to continue" : "Please wait…"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
