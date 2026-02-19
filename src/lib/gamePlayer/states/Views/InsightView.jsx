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

  // allow array: ["a","b"] OR [{text:"a"}]
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

  // allow object: {0:"A", 1:"B"} or {a:"A", b:"B"}
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
  // Aim: big tiles + lots of space. Keep rows small.
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(n / 4) };
}

export default function InsightView({ session, node, dispatch, width, height }) {
  const insights = useMemo(() => normalizeInsights(node), [node]);
  const options = useMemo(() => normalizeOptions(node), [node]);
  const question = String(node?.question ?? "").trim();

  const [i, setI] = useState(0);
  const current = insights[i]?.text ?? "";

  const hasOptions = options.length > 0;

  const { cols } = useMemo(() => gridConfig(options.length), [options.length]);

  const onPickOption = (opt) => {
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

    // For now: advance immediately (you said logging later)
    dispatch(commands.next({ source: "insight", optionId: opt.id }));
  };

  const onNextInsight = () => {
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

      {/* Top bar: question + current insight */}
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
              Tap an option below to continue
            </div>
          )}
        </div>
      </div>

      {/* Options grid (only when options exist) */}
      {hasOptions ? (
        <div className="absolute inset-x-0 top-[220px] bottom-0 p-8">
          <div className="mx-auto max-w-6xl h-full">
            {/* Big gaps = “rest space” */}
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
                  data-cursor-id={`insight-opt-${opt.id ?? idx}`}
                  onClick={() => onPickOption(opt)}
                  className={[
                    "rounded-[28px] ring-2 ring-white/20",
                    "bg-black/55 hover:bg-black/45 active:bg-black/40",
                    "transition-all duration-150",
                    "p-8 text-left",
                    "flex items-center justify-center",
                    "min-h-[140px]",
                  ].join(" ")}
                >
                  <div className="w-full">
                    <div className="text-white/95 font-semibold leading-snug text-2xl">
                      {opt.label}
                    </div>
                    <div className="mt-3 text-white/45 text-xs">
                      Option {idx + 1}
                    </div>
                  </div>
                </button>
              ))}

              {/* If you want extra “rest area” even when grid isn't full:
                  render empty spacers to fill the last row */}
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
        // Bottom controls (only when no options)
        <div className="absolute left-0 right-0 bottom-0 p-8">
          <div className="mx-auto max-w-6xl rounded-3xl bg-black/70 ring-1 ring-white/15 backdrop-blur-md p-6">
            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white"
                onClick={() => dispatch(commands.next({ source: "insight-skip" }))}
              >
                Skip
              </button>

              <button
                type="button"
                className="px-8 py-3 rounded-2xl bg-white text-black hover:bg-gray-200 font-semibold"
                onClick={onNextInsight}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
