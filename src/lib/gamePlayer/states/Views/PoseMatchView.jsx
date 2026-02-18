"use client";

import { useMemo, useState } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";

/**
 * Replace the "score" logic with your real matcher later.
 * Node can include:
 *  - targetPoseId, threshold, prompt, etc.
 */
export default function PoseMatchView({ node, dispatch, poseDataRef }) {
  const threshold = node?.threshold ?? 0.85;
  const [lastScore, setLastScore] = useState(null);

  // Example “score” placeholder (you will replace this)
  const score = useMemo(() => {
    // If pose exists, pretend we have some score
    const hasPose = !!poseDataRef?.current?.poseLandmarks;
    return hasPose ? 0.9 : 0.0;
  }, [poseDataRef?.current]); // (ok for placeholder; real scoring should run in raf)

  const matched = score >= threshold;

  return (
    <div className="absolute inset-0 z-30 flex items-end pointer-events-none">
      <div className="w-full bg-black/70 text-white p-6 pointer-events-auto">
        <div className="text-lg font-semibold">Pose Match</div>
        <div className="text-sm text-gray-300 mt-1">
          Target: {node?.targetPoseId ?? "—"} | Threshold: {threshold}
        </div>

        <div className="mt-3">
          Current score: <span className="font-mono">{score.toFixed(2)}</span>{" "}
          {matched ? <span className="text-green-300">(matched)</span> : <span className="text-yellow-300">(keep trying)</span>}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            className="px-4 py-2 rounded bg-white text-black hover:bg-gray-200"
            onClick={() => {
              const payload = { score, matched, threshold, targetPoseId: node?.targetPoseId ?? null };
              setLastScore(score);
              dispatch({ type: "COMMAND", name: "POSE_MATCH_RESULT", payload });
              if (matched) dispatch(commands.next());
            }}
          >
            Submit / Check
          </button>

          <button
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
            onClick={() => dispatch(commands.next())}
          >
            Continue
          </button>

          {lastScore != null && (
            <div className="ml-auto text-xs text-gray-300 self-center">
              last submitted: {lastScore.toFixed(2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
