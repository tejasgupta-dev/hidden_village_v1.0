"use client";

import { useState } from "react";

export default function InsightState({ level, onComplete, storeEvent }) {
  const insights = level.insights || [
    "Notice how your movement aligns with the model.",
    "Remember to keep your posture straight!"
  ];

  const [index, setIndex] = useState(0);

  const next = () => {
    storeEvent("insight_next", { index });

    if (index < insights.length - 1) {
      setIndex(index + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="absolute bottom-0 w-full bg-black/80 p-6 text-white">
      <h2 className="text-xl font-bold mb-2">Insight</h2>
      <p className="text-lg mb-4">{insights[index]}</p>

      <button
        onClick={next}
        className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition"
      >
        Next
      </button>
    </div>
  );
}
