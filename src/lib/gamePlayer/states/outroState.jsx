"use client";

import { useState } from "react";

export default function OutroState({ dialogues, onComplete, storeEvent }) {
  const [index, setIndex] = useState(0);

  const next = () => {
    storeEvent("outro_next", { index });

    if (index < dialogues.length - 1) {
      setIndex(index + 1);
    } else {
      onComplete();
    }
  };

  const currentDialogue = dialogues[index];

  return (
    <div className="absolute bottom-0 w-full bg-black/80 p-6 text-white">
      <h2 className="text-xl font-bold mb-2">Session Complete</h2>
      
      {/* Render speaker if it exists */}
      {currentDialogue.speaker && (
        <p className="text-sm font-semibold mb-2 text-gray-300">
          {currentDialogue.speaker}
        </p>
      )}
      
      {/* Render the text property, not the whole object */}
      <p className="text-lg mb-4">
        {currentDialogue.text || currentDialogue}
      </p>

      <button
        onClick={next}
        className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition"
      >
        Next
      </button>
    </div>
  );
}