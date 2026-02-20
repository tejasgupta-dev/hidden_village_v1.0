"use client";

import { useMemo, useState } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";

function normalizeInsights(node) {
  const raw = node?.insights ?? node?.lines ?? node?.dialogues ?? null;

  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.lines)
    ? raw.lines
    : Array.isArray(raw?.dialogues)
    ? raw.dialogues
    : [];

  const normalized = arr
    .map((x) => {
      if (typeof x === "string") return { text: x };
      if (x && typeof x === "object") return { text: x.text ?? "", speaker: x.speaker };
      return null;
    })
    .filter(Boolean)
    .filter((x) => String(x.text ?? "").trim().length > 0);

  if (normalized.length) return normalized;

  return [
    { text: "Notice how your movement aligns with the model." },
    { text: "Keep your posture tall and relaxed." },
  ];
}

function normalizeOptions(node) {
  const raw = node?.options ?? node?.answers ?? node?.choices ?? null;
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((x, idx) => {
        if (typeof x === "string") return { id: String(idx), label: x };
        if (x && typeof x === "object") {
          return { id: String(x.id ?? idx), label: String(x.label ?? x.text ?? "") };
        }
        return null;
      })
      .filter(Boolean)
      .filter((o) => o.label.trim().length > 0);
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .map(([k, v], idx) => {
        const label = typeof v === "string" ? v : String(v?.label ?? v?.text ?? "");
        return { id: String(k ?? idx), label };
      })
      .filter((o) => o.label.trim().length > 0);
  }

  return [];
}

function gridConfig(n) {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(n / 4) };
}

function PoseFillBar() {
  return (
    <>
      {/* track */}
      <span className="pointer-events-none absolute left-0 bottom-0 h-[8px] w-full bg-white/10" />
      {/* fill uses CSS var set by PoseCursor: --pose-progress */}
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

export default function InsightView({ session, node, dispatch }) {
  const insights = useMemo(() => normalizeInsights(node), [node]);
  const options = useMemo(() => normalizeOptions(node), [node]);
  const question = String(node?.question ?? "").trim();

  const showCursor = !!session?.flags?.showCursor;

  const [i, setI] = useState(0);
  const current = insights[i]?.text ?? "";

  const hasOptions = options.length > 0;
  const { cols } = useMemo(() => gridConfig(options.length), [options.length]);

  // you can tune these per-state if you want
  const OPTION_HOVER_MS = 900;
  const NEXT_HOVER_MS = 700;
  const SKIP_HOVER_MS = 900;

  const onPickOption = (opt) => {
    if (!showCursor) return;

    dispatch({
      type: "COMMAND",
      name: "INSIGHT_OPTION_SELECTED",
      payload: {
        optionId: opt.id,
        optionLabel: opt.label,
        question: question || null,
        insightIndex: i,
        insightText: current,
      },
    });

    dispatch(commands.next({ source: "insight", optionId: opt.id }));
  };

  const onNextInsight = () => {
    if (!showCursor) return;

    dispatch({
      type: "COMMAND",
      name: "INSIGHT_RESULT",
      payload: { index: i, text: current, question: question || null },
    });

    if (i < insights.length - 1) setI(i + 1);
    else dispatch(commands.next({ source: "insight" }));
  };

  const fontSize = session?.settings?.ui?.dialogueFontSize ?? 22;

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto">
      <div className="absolute inset-0 bg-black/35" />

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 p-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-black/70 ring-1 ring-white/15 backdrop-blur-md p-8">
          <div className="text-white/60 text-sm">Insight</div>

          {question ? (
            <div className="mt-2 text-white/95 font-semibold leading-tight" style={{ fontSize: 34 }}>
              {question}
            </div>
          ) : null}

          <div
            className={question ? "mt-4 text-white/90" : "mt-2 text-white/95 font-semibold"}
            style={{ fontSize: question ? fontSize : 26 }}
          >
            {current}
          </div>

          {!hasOptions ? (
            <div className="mt-4 text-white/50 text-sm">
              {i + 1} / {insights.length}
            </div>
          ) : (
            <div className="mt-4 text-white/50 text-sm">
              {showCursor ? "Hover an option to continue" : "Please wait…"}
            </div>
          )}
        </div>
      </div>

      {/* Options grid */}
      {hasOptions ? (
        <div className="absolute inset-x-0 top-[220px] bottom-0 p-8">
          <div className="mx-auto max-w-6xl h-full">
            <div
              className="h-full grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gap: "28px",
              }}
            >
              {options.map((opt, idx) => (
                <button
                  key={opt.id ?? idx}
                  type="button"
                  onClick={() => onPickOption(opt)}
                  disabled={!showCursor}
                  data-pose-hover-ms={OPTION_HOVER_MS}
                  className={[
                    "next-button", // ✅ PoseCursor selector
                    "relative overflow-hidden", // ✅ progress bar
                    "rounded-[28px] ring-2 ring-white/20",
                    showCursor
                      ? "bg-black/55 hover:bg-black/45 active:bg-black/40"
                      : "bg-black/30 opacity-50 cursor-not-allowed",
                    "transition-all duration-150",
                    "p-8 text-left",
                    "flex items-center justify-center",
                    "min-h-[140px]",
                  ].join(" ")}
                >
                  <PoseFillBar />

                  <div className="relative z-10 w-full">
                    <div className="text-white/95 font-semibold leading-snug text-2xl">
                      {opt.label}
                    </div>
                    <div className="mt-3 text-white/45 text-xs">Option {idx + 1}</div>
                  </div>
                </button>
              ))}

              {(() => {
                const totalSlots = Math.ceil(options.length / cols) * cols;
                const empties = totalSlots - options.length;
                return Array.from({ length: empties }).map((_, k) => (
                  <div
                    key={`spacer-${k}`}
                    className="rounded-[28px] bg-transparent"
                    aria-hidden="true"
                  />
                ));
              })()}
            </div>
          </div>
        </div>
      ) : (
        // Bottom controls (no options)
        <div className="absolute left-0 right-0 bottom-0 p-8">
          <div className="mx-auto max-w-6xl rounded-3xl bg-black/70 ring-1 ring-white/15 backdrop-blur-md p-6">
            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                disabled={!showCursor}
                data-pose-hover-ms={SKIP_HOVER_MS}
                onClick={() => dispatch(commands.next({ source: "insight-skip" }))}
                className={[
                  "next-button",
                  "relative overflow-hidden",
                  "px-6 py-3 rounded-2xl text-white",
                  showCursor
                    ? "bg-white/10 hover:bg-white/20"
                    : "bg-white/5 text-white/40 cursor-not-allowed",
                ].join(" ")}
              >
                <PoseFillBar />
                <span className="relative z-10">Skip</span>
              </button>

              <button
                type="button"
                disabled={!showCursor}
                data-pose-hover-ms={NEXT_HOVER_MS}
                onClick={onNextInsight}
                className={[
                  "next-button",
                  "relative overflow-hidden",
                  "px-8 py-3 rounded-2xl font-semibold",
                  showCursor
                    ? "bg-white text-black hover:bg-gray-200"
                    : "bg-white/10 text-white/40 cursor-not-allowed",
                ].join(" ")}
              >
                <PoseFillBar />
                <span className="relative z-10">Next →</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
