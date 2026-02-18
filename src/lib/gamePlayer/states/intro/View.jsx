"use client";

import { useEffect, useMemo, useRef } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";
import PoseHoverButton from "../_shared/poseHoverButton";

function DefaultSpeakerSprite() {
  return (
    <div className="h-24 w-24 rounded-2xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
      <div className="h-14 w-14 rounded-full bg-white/15 flex items-center justify-center text-white/80 font-semibold">
        G
      </div>
    </div>
  );
}

export default function IntroView({ session, node, dispatch }) {
  const lines = useMemo(() => {
    const arr = node?.lines ?? node?.dialogues ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [node]);

  const idx = session?.dialogueIndex ?? 0;
  const line = lines[idx] ?? "";
  const showCursor = !!session?.flags?.showCursor;

  const speakerName = node?.speaker?.name ?? "Guide";
  const avatarUrl = node?.speaker?.avatarUrl ?? null;

  // Autoplay: advance dialogue every 10s (per line), but only when cursor is enabled
  const autoMS = 10_000;
  const nodeIndexRef = useRef(session?.nodeIndex ?? 0);
  nodeIndexRef.current = session?.nodeIndex ?? 0;

  useEffect(() => {
    if (!lines.length) return;
    if (!showCursor) return;

    const startNodeIndex = nodeIndexRef.current;

    const t = window.setTimeout(() => {
      // If we changed nodes, don't fire.
      if (nodeIndexRef.current !== startNodeIndex) return;
      dispatch(commands.next());
    }, autoMS);

    return () => window.clearTimeout(t);
  }, [dispatch, idx, lines.length, showCursor]);

  const onNext = () => dispatch(commands.next());

  return (
    <div className="absolute inset-0 z-20 pointer-events-auto">
      {/* Background overlay (optional) */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Bottom dialogue bar */}
      <div className="absolute left-0 right-0 bottom-0 p-6">
        <div className="mx-auto max-w-5xl rounded-3xl bg-black/60 ring-1 ring-white/15 backdrop-blur-md p-5">
          <div className="flex gap-5 items-end">
            {/* Speaker sprite */}
            <div className="shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={speakerName}
                  className="h-24 w-24 rounded-2xl object-cover ring-1 ring-white/20"
                />
              ) : (
                <DefaultSpeakerSprite />
              )}
              <div className="mt-2 text-xs text-white/70 text-center">{speakerName}</div>
            </div>

            {/* Dialogue text */}
            <div className="flex-1 min-w-0">
              <div className="text-white/90 text-lg leading-snug">
                {line || (lines.length ? "…" : "No intro lines provided.")}
              </div>

              {/* Subline: line counter */}
              {lines.length > 0 && (
                <div className="mt-2 text-xs text-white/50">
                  {Math.min(idx + 1, lines.length)} / {lines.length}
                </div>
              )}
            </div>

            {/* Next button */}
            <div className="shrink-0 flex flex-col items-end gap-2">
              <PoseHoverButton
                disabled={!showCursor}
                hoverEnabled={showCursor}
                hoverDelayMS={node?.cursorDelayMS ?? session?.settings?.cursor?.delayMS ?? 900}
                onClick={onNext}
                className={[
                  "px-5 py-3 rounded-2xl font-medium",
                  "ring-1 ring-white/20",
                  showCursor ? "bg-white/15 text-white hover:bg-white/20" : "bg-white/5 text-white/40",
                ].join(" ")}
              >
                Next
              </PoseHoverButton>

              <div className="text-[11px] text-white/50">
                {showCursor ? "Click or hover to continue" : "Please wait…"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
