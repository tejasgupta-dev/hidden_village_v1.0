"use client";

import { useState } from "react";
import { commands } from "@/lib/gamePlayer/session/commands";

export default function InsightView({ node, dispatch }) {
  const insights = node?.insights ?? node?.lines ?? node?.dialogues ?? [
    "Notice how your movement aligns with the model.",
    "Keep your posture tall and relaxed.",
  ];

  const [i, setI] = useState(0);

  const current = insights[i]?.text ?? insights[i];

  return (
    <div className="absolute inset-0 z-30 flex items-end pointer-events-none">
      <div className="w-full bg-black/70 text-white p-6 pointer-events-auto">
        <div className="text-lg font-semibold">Insight</div>

        <div className="mt-2 text-base">{current}</div>

        <div className="mt-4 flex gap-3">
          <button
            className="px-4 py-2 rounded bg-white text-black hover:bg-gray-200"
            onClick={() => {
              dispatch({
                type: "COMMAND",
                name: "INSIGHT_RESULT",
                payload: { index: i, text: current },
              });

              if (i < insights.length - 1) setI(i + 1);
              else dispatch(commands.next());
            }}
          >
            Next
          </button>

          <button
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
            onClick={() => dispatch(commands.next())}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
