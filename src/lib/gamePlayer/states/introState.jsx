"use client";

import { useState } from "react";

export default function IntroState({ 
  dialogues = [], 
  onComplete, 
  storeEvent 
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    // Store the event for analytics / gameplay data
    storeEvent?.("intro_next", { index: currentIndex });

    if (currentIndex < dialogues.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete?.();
    }
  };

  if (!dialogues.length) return null;

  const currentDialogue = dialogues[currentIndex];

  return (
    <div className="absolute bottom-0 w-full bg-black/80 p-6 text-white z-50">
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
        onClick={handleNext}
        className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition"
      >
        Next
      </button>
    </div>
  );
}