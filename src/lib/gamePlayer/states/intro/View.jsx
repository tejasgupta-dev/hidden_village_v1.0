"use client";

import React, { useEffect, useMemo, useRef } from "react";

// Normalize a dialogue line into a safe shape:
// - supports string lines: "Hello"
// - supports object lines: { text, speaker } (your Firebase shape)
// - supports common alternates: { line }, { message }, etc.
function normalizeLine(line, fallbackSpeaker) {
  if (line == null) return { text: "", speaker: fallbackSpeaker ?? null };

  // string
  if (typeof line === "string") {
    return { text: line, speaker: fallbackSpeaker ?? null };
  }

  // object
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

  // number/boolean/etc
  return { text: String(line), speaker: fallbackSpeaker ?? null };
}

export default function IntroView({ session, node, dispatch, poseDataRef }) {
  const lines = Array.isArray(node?.lines) ? node.lines : [];
  const idx = session?.dialogueIndex ?? 0;

  const current = useMemo(() => {
    const raw = lines[idx];
    return normalizeLine(raw, node?.speaker ?? { name: "Guide" });
  }, [lines, idx, node?.speaker]);

  const speakerName = useMemo(() => {
    // speaker can be {name}, or just a string, or null
    const s = current?.speaker ?? node?.speaker;
    if (!s) return "Guide";
    if (typeof s === "string") return s;
    return s.name ?? s.label ?? "Guide";
  }, [current?.speaker, node?.speaker]);

  // optional: your existing autoplay logic might live here.
  // I’m leaving behavior unchanged unless you already had timers.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
    }
  }, []);

  return (
    <div className="w-full h-full flex flex-col justify-end gap-3 p-6">
      {/* Speaker */}
      <div className="text-sm opacity-80">
        {speakerName}
      </div>

      {/* Text */}
      <div className="text-xl leading-relaxed">
        {current.text}
      </div>

      {/* You likely already have your cursor / next button elsewhere;
          this file only fixes the React child error. */}
    </div>
  );
}
