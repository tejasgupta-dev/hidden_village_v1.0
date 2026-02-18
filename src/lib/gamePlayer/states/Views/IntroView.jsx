"use client";

import { useMemo } from "react";
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

export default function IntroView({ session, node, dispatch }) {
  const lines = useMemo(() => {
    const arr = node?.lines ?? node?.dialogues ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [node]);

  const idx = session?.dialogueIndex ?? 0;

  // Support both string lines AND { text, speaker } objects
  const rawLine = lines[idx] ?? "";
  const line =
    typeof rawLine === "object" && rawLine !== null ? rawLine.text ?? "" : rawLine;

  const showCursor = !!session?.flags?.showCursor;

  const speakerName =
    typeof rawLine === "object" && rawLine?.speaker
      ? rawLine.speaker
      : node?.speaker?.name ?? "Guide";

  const avatarUrl = node?.speaker?.avatarUrl ?? null;

  const onNext = () => dispatch(commands.next());

  return (
    <div className="absolute inset-0 z-20 pointer-events-auto">
      {/* Subtle background overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Bottom dialogue bar */}
      <div className="absolute left-0 right-0 bottom-0 p-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-black/70 ring-1 ring-white/15 backdrop-blur-md p-8">
          <div className="flex gap-8 items-end">
            {/* Speaker sprite */}
            <div className="shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={speakerName}
                  className="h-28 w-28 rounded-3xl object-cover ring-1 ring-white/20"
                />
              ) : (
                <DefaultSpeakerSprite />
              )}
              <div className="mt-3 text-sm text-white/70 text-center">
                {speakerName}
              </div>
            </div>

            {/* Dialogue text */}
            <div className="flex-1 min-w-0">
              <div
                className="text-white/95 leading-relaxed"
                style={{
                  fontSize: session.settings?.ui?.dialogueFontSize ?? 22,
                }}
              >
                {line || (lines.length ? "…" : "No intro lines provided.")}
              </div>

              {lines.length > 0 && (
                <div className="mt-3 text-sm text-white/50">
                  {Math.min(idx + 1, lines.length)} / {lines.length}
                </div>
              )}
            </div>

            {/* Next button (mouse click or PoseCursor hover triggers DOM click) */}
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
