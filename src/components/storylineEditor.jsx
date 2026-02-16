"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

const SECTIONS = ["intro", "outro"];

export default function StorylineEditor({ game, setGame, onClose }) {
  const [levelIndex, setLevelIndex] = useState(0);

  const levelIds = game.levelIds ?? [];
  const levelStory = (game.storyline ?? [])[levelIndex] ?? {
    intro: [],
    outro: [],
  };

  /* -------------------------------------------------------
     HELPERS
  ------------------------------------------------------- */

  function ensureLevel(index) {
    const newGame = {
      ...game,
      storyline: (game.storyline ?? []).map((l) =>
        l
          ? {
              intro: [...(l.intro ?? [])],
              outro: [...(l.outro ?? [])],
            }
          : { intro: [], intuition: [], outro: [] }
      ),
    };

    while (newGame.storyline.length <= index) {
      newGame.storyline.push({ intro: [], outro: [] });
    }

    return newGame;
  }

  /* -------------------------------------------------------
     DIALOGUE CRUD
  ------------------------------------------------------- */

  function addDialogue(section) {
    const newGame = ensureLevel(levelIndex);
    newGame.storyline[levelIndex][section] = [
      ...(newGame.storyline[levelIndex][section] ?? []),
      { speaker: "", text: "" },
    ];
    setGame(newGame);
  }

  function updateDialogue(section, i, field, value) {
    const newGame = ensureLevel(levelIndex);
    const entries = [...(newGame.storyline[levelIndex][section] ?? [])];
    entries[i] = { ...entries[i], [field]: value };
    newGame.storyline[levelIndex][section] = entries;
    setGame(newGame);
  }

  function removeDialogue(section, i) {
    const newGame = ensureLevel(levelIndex);
    const entries = [...(newGame.storyline[levelIndex][section] ?? [])];
    entries.splice(i, 1);
    newGame.storyline[levelIndex][section] = entries;
    setGame(newGame);
  }

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-auto rounded-lg p-6">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Storyline Editor</h2>
          <X className="cursor-pointer" onClick={onClose} />
        </div>

        {/* NO LEVELS */}
        {levelIds.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No levels added yet. Add levels from the game editor first.
          </p>
        ) : (
          <>
            {/* LEVEL TABS */}
            <div className="flex flex-wrap gap-2 mb-6">
              {levelIds.map((id, i) => (
                <button
                  key={id}
                  onClick={() => setLevelIndex(i)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    i === levelIndex
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300"
                  }`}
                >
                  Level {i + 1}
                  <span className="ml-1 text-xs opacity-70">({id})</span>
                </button>
              ))}
            </div>

            {/* SECTIONS */}
            {SECTIONS.map((section) => (
              <div key={section} className="mb-8">
                <h3 className="font-semibold capitalize text-gray-700 border-b pb-1 mb-3">
                  {section}
                </h3>

                {(levelStory[section] ?? []).map((dialogue, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-center">
                    <input
                      placeholder="Speaker"
                      value={dialogue.speaker}
                      onChange={(e) =>
                        updateDialogue(section, i, "speaker", e.target.value)
                      }
                      className="border p-2 rounded w-32 text-sm"
                    />
                    <input
                      placeholder="Dialogue"
                      value={dialogue.text}
                      onChange={(e) =>
                        updateDialogue(section, i, "text", e.target.value)
                      }
                      className="border p-2 rounded flex-1 text-sm"
                    />
                    <Trash2
                      size={16}
                      className="cursor-pointer text-red-500 hover:text-red-700 shrink-0"
                      onClick={() => removeDialogue(section, i)}
                    />
                  </div>
                ))}

                <button
                  onClick={() => addDialogue(section)}
                  className="flex items-center gap-1 mt-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Plus size={14} />
                  Add line
                </button>
              </div>
            ))}
          </>
        )}

        {/* FOOTER */}
        <div className="flex justify-end pt-4 border-t mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 text-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}