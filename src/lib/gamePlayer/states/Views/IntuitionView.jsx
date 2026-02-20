"use client";

import { useMemo, useState } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function PoseFillBar() {
  return (
    <>
      <span className="pointer-events-none absolute left-0 bottom-0 h-[8px] w-full bg-white/10" />
      <span
        className="pointer-events-none absolute left-0 bottom-0 h-[8px] bg-green-500/80"
        style={{
          width: "calc(var(--pose-progress, 0) * 100%)",
          transition: "width 50ms linear",
        }}
      />
    </>
  );
}

export default function IntuitionView({ session, node, dispatch }) {
  const question = useMemo(() => {
    const q = String(node?.question ?? "").trim();
    return q.length ? q : "True or False?";
  }, [node?.question]);

  const showCursor = !!session?.flags?.showCursor;
  const [choice, setChoice] = useState(null); // true | false | null

  const trueActive = choice === true;
  const falseActive = choice === false;

  const PICK_HOVER_MS = 900;

  const onPick = (v) => {
    if (!showCursor) return;
    if (choice !== null) return;
    setChoice(v);
    dispatch(commands.next({ source: "intuition", answer: v }));
  };

  const baseCard =
    "next-button relative overflow-hidden w-full rounded-[28px] ring-2 transition-all duration-150 select-none";
  const activeCard =
    "bg-white/25 ring-white/60 shadow-[0_0_0_2px_rgba(255,255,255,0.25)]";
  const idleCard = "bg-black/35 ring-white/20 hover:bg-black/25 hover:ring-white/35";
  const disabledCard = "opacity-50 cursor-not-allowed";

  const disabled = !showCursor || choice !== null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto">
      <div className="absolute inset-0 bg-black/40" />

      {/* Top question */}
      <div className="absolute left-0 right-0 top-0 p-8">
        <div className="mx-auto max-w-5xl rounded-3xl bg-black/60 ring-1 ring-white/15 backdrop-blur-md p-8">
          <div className="text-white/70 text-sm mb-2">Intuition</div>

          <div
            className="text-white/95 font-semibold leading-tight"
            style={{
              fontSize: clamp(session?.settings?.ui?.dialogueFontSize ?? 28, 22, 44),
            }}
          >
            {question}
          </div>

          <div className="mt-3 text-white/50 text-sm">
            Choose <span className="text-white/80 font-semibold">TRUE</span> or{" "}
            <span className="text-white/80 font-semibold">FALSE</span>.
          </div>
        </div>
      </div>

      {/* Big TRUE / FALSE boxes */}
      <div className="absolute inset-x-0 top-[200px] bottom-0 p-8">
        <div className="mx-auto max-w-5xl h-full flex flex-col justify-center gap-6">
          <button
            type="button"
            onClick={() => onPick(true)}
            disabled={disabled}
            data-pose-hover-ms={PICK_HOVER_MS}
            className={[
              baseCard,
              trueActive ? activeCard : idleCard,
              disabled ? disabledCard : "",
              "p-10 text-left",
            ].join(" ")}
          >
            <PoseFillBar />

            <div className="relative z-10 flex items-center justify-between gap-6">
              <div>
                <div className="text-white/95 font-extrabold tracking-wide text-5xl">TRUE</div>
                <div className="mt-3 text-white/70 text-base">
                  Select if the statement is correct.
                </div>
              </div>

              <div
                className={[
                  "h-16 w-16 rounded-2xl ring-2 flex items-center justify-center",
                  trueActive ? "bg-white/20 ring-white/60" : "bg-white/5 ring-white/20",
                ].join(" ")}
                aria-hidden="true"
              >
                <div className="text-white/90 text-2xl">{trueActive ? "✓" : ""}</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onPick(false)}
            disabled={disabled}
            data-pose-hover-ms={PICK_HOVER_MS}
            className={[
              baseCard,
              falseActive ? activeCard : idleCard,
              disabled ? disabledCard : "",
              "p-10 text-left",
            ].join(" ")}
          >
            <PoseFillBar />

            <div className="relative z-10 flex items-center justify-between gap-6">
              <div>
                <div className="text-white/95 font-extrabold tracking-wide text-5xl">FALSE</div>
                <div className="mt-3 text-white/70 text-base">
                  Select if the statement is incorrect.
                </div>
              </div>

              <div
                className={[
                  "h-16 w-16 rounded-2xl ring-2 flex items-center justify-center",
                  falseActive ? "bg-white/20 ring-white/60" : "bg-white/5 ring-white/20",
                ].join(" ")}
                aria-hidden="true"
              >
                <div className="text-white/90 text-2xl">{falseActive ? "✓" : ""}</div>
              </div>
            </div>
          </button>

          <div className="text-center text-white/45 text-xs pt-2">
            {!showCursor
              ? "Please wait…"
              : choice === null
              ? "Hover to select (progress fills), or click."
              : "Selected — continuing…"}
          </div>
        </div>
      </div>
    </div>
  );
}
