"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

const SECTIONS = ["intro", "intuition", "outro"];

export default function StorylineEditor({
  game,
  setGame,
  onClose,
}) {
  const [levelIndex, setLevelIndex] = useState(0);

  const storyline = game.storyline || [];

  const levelStory =
    storyline[levelIndex] ||
    {
      intro: [],
      intuition: [],
      outro: [],
    };

  function ensureLevel(index) {
    const newGame = { ...game };

    if (!newGame.storyline)
      newGame.storyline = [];

    if (!newGame.storyline[index]) {
      newGame.storyline[index] = {
        intro: [],
        intuition: [],
        outro: [],
      };
    }

    return newGame;
  }

  function addDialogue(section) {
    const newGame = ensureLevel(levelIndex);

    newGame.storyline[levelIndex][section].push({
      speaker: "",
      text: "",
    });

    setGame(newGame);
  }

  function updateDialogue(section, i, field, value) {
    const newGame = ensureLevel(levelIndex);

    newGame.storyline[levelIndex][section][i][field] =
      value;

    setGame(newGame);
  }

  function removeDialogue(section, i) {
    const newGame = ensureLevel(levelIndex);

    newGame.storyline[levelIndex][section].splice(i, 1);

    setGame(newGame);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center">

      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-auto rounded-lg p-4">

        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">
            Storyline Editor
          </h2>

          <X
            className="cursor-pointer"
            onClick={onClose}
          />
        </div>

        {/* LEVEL SELECT */}
        <div className="flex gap-2 mb-4">
          {game.levelIds.map((id, i) => (
            <button
              key={id}
              onClick={() => setLevelIndex(i)}
              className={`px-3 py-1 rounded ${
                i === levelIndex
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200"
              }`}
            >
              Level {i + 1}
            </button>
          ))}
        </div>

        {/* SECTIONS */}
        {SECTIONS.map((section) => (

          <div key={section} className="mb-6">

            <div className="flex justify-between mb-2">

              <h3 className="font-semibold capitalize">
                {section}
              </h3>

              <button
                onClick={() => addDialogue(section)}
                className="flex gap-1 items-center bg-blue-600 text-white px-2 py-1 rounded"
              >
                <Plus size={16}/>
                Add
              </button>

            </div>

            {(levelStory[section] || []).map(
              (dialogue, i) => (

              <div key={i} className="flex gap-2 mb-2">

                <input
                  placeholder="Speaker"
                  value={dialogue.speaker}
                  onChange={(e) =>
                    updateDialogue(
                      section,
                      i,
                      "speaker",
                      e.target.value
                    )
                  }
                  className="border p-2 w-32"
                />

                <input
                  placeholder="Dialogue"
                  value={dialogue.text}
                  onChange={(e) =>
                    updateDialogue(
                      section,
                      i,
                      "text",
                      e.target.value
                    )
                  }
                  className="border p-2 flex-1"
                />

                <Trash2
                  className="cursor-pointer text-red-600"
                  onClick={() =>
                    removeDialogue(section, i)
                  }
                />

              </div>

            ))}

          </div>

        ))}

      </div>

    </div>
  );
}
