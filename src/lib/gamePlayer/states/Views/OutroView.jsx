"use client";

import { useMemo } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";
import { DEFAULT_SPEAKERS } from "@/lib/assets/defaultSprites";

function DefaultSpeakerSprite({ label = "G" }) {
  return (
    <div className="h-28 w-28 rounded-3xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
      <div className="h-16 w-16 rounded-full bg-white/15 flex items-center justify-center text-white/80 font-semibold text-xl">
        {label}
      </div>
    </div>
  );
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export default function OutroView({ session, node, dispatch }) {
  const lines = useMemo(() => {
    const arr = node?.lines ?? node?.dialogues ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [node]);

  const idx = session?.dialogueIndex ?? 0;

  const rawLine = lines[idx] ?? "";
  const line =
    typeof rawLine === "object" && rawLine !== null ? rawLine.text ?? "" : rawLine;

  const showCursor = !!session?.flags?.showCursor;

  const { speakerName, avatarUrl } = useMemo(() => {
    let speakerId = null;

    if (typeof rawLine === "object" && rawLine !== null) {
      if (rawLine.speakerId) {
        speakerId = String(rawLine.speakerId);
      } else if (typeof rawLine.speaker === "object" && rawLine.speaker?.id) {
        speakerId = String(rawLine.speaker.id);
      } else if (typeof rawLine.speaker === "string") {
        speakerId = String(rawLine.speaker);
      }
    }

    const customMap =
      session?.game?.settings?.speakers && isPlainObject(session.game.settings.speakers)
        ? session.game.settings.speakers
        : {};

    if (speakerId && customMap[speakerId]) {
      return {
        speakerName: customMap[speakerId]?.name ?? speakerId,
        avatarUrl: customMap[speakerId]?.url ?? null,
      };
    }

    const defaultSpeaker = DEFAULT_SPEAKERS?.find((s) => s.id === speakerId) ?? null;
    if (defaultSpeaker) {
      return {
        speakerName: defaultSpeaker.name,
        avatarUrl: defaultSpeaker.url ?? null,
      };
    }

    // Fallback to node speaker or "Guide"
    return {
      speakerName:
        (typeof rawLine === "object" && rawLine?.speakerName) ||
        node?.speaker?.name ||
        "Guide",
      avatarUrl: null,
    };
  }, [rawLine, node?.speaker?.name, session?.game?.settings?.speakers]);

  const onNext = () => dispatch(commands.next());

  return (
    <div className="absolute inset-0 z-20 pointer-events-auto">
      <div className="absolute inset-0 bg-black/30" />

      <div className="absolute left-0 right-0 bottom-0 p-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-black/70 ring-1 ring-white/15 backdrop-blur-md p-8">
          <div className="flex gap-8 items-end">
            <div className="shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={speakerName}
                  className="h-28 w-28 rounded-3xl object-cover ring-1 ring-white/20"
                />
              ) : (
                <DefaultSpeakerSprite label={String(speakerName || "G").charAt(0).toUpperCase()} />
              )}
              <div className="mt-3 text-sm text-white/70 text-center">{speakerName}</div>
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="text-white/95 leading-relaxed"
                style={{ fontSize: session?.settings?.ui?.dialogueFontSize ?? 22 }}
              >
                {line || (lines.length ? "…" : "No outro lines provided.")}
              </div>

              {lines.length > 0 && (
                <div className="mt-3 text-sm text-white/50">
                  {Math.min(idx + 1, lines.length)} / {lines.length}
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