"use client";

import React, { useMemo } from "react";

function normalizeLine(line, fallbackSpeaker) {
  if (line == null) return { text: "", speaker: fallbackSpeaker ?? null };

  if (typeof line === "string") {
    return { text: line, speaker: fallbackSpeaker ?? null };
  }

  if (typeof line === "object") {
    const text =
      line.text ??
      line.line ??
      line.message ??
      line.value ??
      "";

    const speaker =
      line.speaker ??
      line.speakerName ??
      fallbackSpeaker ??
      null;

    return { text: String(text ?? ""), speaker };
  }

  return { text: String(line), speaker: fallbackSpeaker ?? null };
}

export default function OutroView({ session, node, dispatch }) {
  const lines = Array.isArray(node?.lines) ? node.lines : [];
  const idx = session?.dialogueIndex ?? 0;

  const current = useMemo(() => {
    const raw = lines[idx];
    return normalizeLine(raw, node?.speaker ?? { name: "Guide" });
  }, [lines, idx, node?.speaker]);

  const speakerName = useMemo(() => {
    const s = current?.speaker ?? node?.speaker;
    if (!s) return "Guide";
    if (typeof s === "string") return s;
    return s.name ?? s.label ?? "Guide";
  }, [current?.speaker, node?.speaker]);

  return (
    <div className="w-full h-full flex flex-col justify-end gap-3 p-6">
      <div className="text-sm opacity-80">{speakerName}</div>
      <div className="text-xl leading-relaxed">{current.text}</div>
    </div>
  );
}
