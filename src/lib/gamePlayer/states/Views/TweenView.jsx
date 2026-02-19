"use client";

import { useMemo } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";
import { Tween } from "@/lib/pose/tween";

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

export default function TweenView({ session, node, dispatch, width = 800, height = 600 }) {
  const showCursor = !!session?.flags?.showCursor;

  const poseMap = useMemo(() => {
    const level = session?.game?.levels?.[session?.levelIndex] ?? null;
    const poses = level?.poses ?? null;
    // DB format you showed: poses is an object map: { pose_<ts>: "<json>", ... }
    return poses && typeof poses === "object" ? poses : null;
  }, [session?.game, session?.levelIndex]);

  const poses = useMemo(() => {
    const ids = Array.isArray(node?.poseIds) ? node.poseIds : [];
    if (!poseMap || ids.length === 0) return [];
    return ids.map((id) => safeParsePose(poseMap[id])).filter(Boolean);
  }, [node?.poseIds, poseMap]);

  const stepDurationMS = node?.stepDurationMS ?? 600;
  const totalDuration = Math.max(1, poses.length - 1) * stepDurationMS;

  const onNext = () => dispatch(commands.next());

  return (
    <div className="absolute inset-0 z-20 pointer-events-auto">
      {/* background overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* main tween area */}
      <div className="absolute inset-0 flex items-center justify-center">
        {poses.length >= 2 ? (
          <Tween
            poses={poses}
            duration={stepDurationMS} // your Tween interprets this as "per segment"
            width={width}
            height={height}
            loop={false}
            isPlaying={true}
          />
        ) : (
          <div className="text-white/80 text-sm">
            Tween needs at least 2 poses (got {poses.length}).
          </div>
        )}
      </div>

      {/* bottom bar exactly like Intro */}
      <div className="absolute left-0 right-0 bottom-0 p-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-black/70 ring-1 ring-white/15 backdrop-blur-md p-8">
          <div className="flex gap-8 items-end">
            {/* "speaker" placeholder (optional) */}
            <div className="shrink-0">
              <DefaultSpeakerSprite />
              <div className="mt-3 text-sm text-white/70 text-center">Tween</div>
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="text-white/95 leading-relaxed"
                style={{ fontSize: session.settings?.ui?.dialogueFontSize ?? 22 }}
              >
                {poses.length >= 2
                  ? `Animating ${poses.length} poses (${totalDuration} ms total).`
                  : "Pose data not available for tween."}
              </div>

              {Array.isArray(node?.poseIds) && node.poseIds.length > 0 && (
                <div className="mt-3 text-sm text-white/50">
                  {node.poseIds.length} pose ids loaded
                </div>
              )}
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
