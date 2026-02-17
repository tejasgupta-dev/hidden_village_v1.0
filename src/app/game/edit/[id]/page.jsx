"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  MoveUp,
  MoveDown,
  Trash2,
  Plus,
  ArrowLeft,
  BookOpen,
  Check,
  X,
} from "lucide-react";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useGameEditor } from "@/lib/hooks/useGameEditor";
import StorylineEditor from "@/components/storylineEditor";

export default function GameEditor() {
  const pathname = usePathname();
  const router = useRouter();
  const id = pathname.split("/").filter(Boolean).pop();
  const { user } = useAuth();

  const {
    game,
    setGame,
    loadingGame,
    savingGame,
    allAvailableLevels,
    addLevel,
    removeLevel,
    getLevelData,
    handleSave,
    handleDelete,
    getStoredPin,
  } = useGameEditor(id, false, user?.email);

  // UI state
  const [showStorylineEditor, setShowStorylineEditor] = useState(false);
  const [showAddLevel, setShowAddLevel] = useState(false);
  const [newLevelId, setNewLevelId] = useState("");
  const [expandedLevel, setExpandedLevel] = useState(null);

  // PIN UI state
  const [editingPin, setEditingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const pinRef = useRef(null);

  // ✅ KEY FIX:
  // If user clicks "Remove PIN", we suppress sessionStorage PIN from being displayed
  // (but sessionStorage still remains for auth until save succeeds).
  const [ignoreStoredPin, setIgnoreStoredPin] = useState(false);

  const handleBack = () => router.push("/");

  /* ------------------ PIN SYNC (don’t overwrite while typing) ------------------ */
  useEffect(() => {
    if (!game) return;
    if (editingPin) return;

    // If user removed pin locally, do NOT hydrate from sessionStorage anymore
    if (ignoreStoredPin) {
      setPinValue(game.pin || "");
      return;
    }

    const sessionPin = getStoredPin?.() || "";
    setPinValue(game.pin || sessionPin || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.pin, id, editingPin, ignoreStoredPin]);

  // If game.pin becomes non-empty (e.g., after load or user sets it), stop ignoring storage
  useEffect(() => {
    if (!game) return;
    if ((game.pin || "").trim()) {
      setIgnoreStoredPin(false);
    }
  }, [game]);

  const storedPin = !ignoreStoredPin ? (getStoredPin?.() || "") : "";

  const hasPin =
    Boolean((game?.pin || "").trim()) ||
    Boolean(game?.hasPin) ||
    Boolean((storedPin || "").trim());

  const handleRemovePin = () => {
    // ✅ ONLY clear locally (draft). Do NOT touch sessionStorage here.
    setGame((prev) => ({ ...prev, pin: "" }));
    setPinValue("");
    setEditingPin(false);

    // ✅ prevent UI from re-hydrating old session pin
    setIgnoreStoredPin(true);
  };

  /* ------------------ LEVEL HANDLERS ------------------ */
  const handleAddLevel = () => {
    const trimmed = newLevelId.trim();
    if (!trimmed) return;
    addLevel(trimmed);
    setNewLevelId("");
    setShowAddLevel(false);
  };

  const moveLevel = (index, direction) => {
    const newIndex = index + direction;
    if (!game) return;
    if (newIndex < 0 || newIndex >= (game.levelIds ?? []).length) return;

    setGame((prev) => {
      const newLevelIds = [...(prev.levelIds || [])];
      const newStoryline = [...(prev.storyline || [])];

      [newLevelIds[index], newLevelIds[newIndex]] = [
        newLevelIds[newIndex],
        newLevelIds[index],
      ];
      [newStoryline[index], newStoryline[newIndex]] = [
        newStoryline[newIndex],
        newStoryline[index],
      ];

      return { ...prev, levelIds: newLevelIds, storyline: newStoryline };
    });
  };

  const toggleExpandLevel = (levelId) => {
    setExpandedLevel((prev) => (prev === levelId ? null : levelId));
  };

  /* ------------------ LOADING / NOT FOUND ------------------ */
  if (loadingGame) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Game not found.
      </div>
    );
  }

  /* ------------------ RENDER ------------------ */
  return (
    <div className="min-h-screen py-6 px-4 max-w-5xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={18} /> Back
        </button>

        <h1 className="text-xl font-bold">Edit Game</h1>
        <div />
      </div>

      {/* GAME INFO */}
      <div className="bg-white p-5 rounded border space-y-4">
        {/* NAME */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Game Name *</label>
          <input
            value={game.name || ""}
            onChange={(e) =>
              setGame((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Enter game name"
            className="border p-2 rounded w-full"
          />
        </div>

        {/* KEYWORDS */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Keywords</label>
          <input
            value={game.keywords || ""}
            onChange={(e) =>
              setGame((prev) => ({ ...prev, keywords: e.target.value }))
            }
            placeholder="puzzle, challenge, easy"
            className="border p-2 rounded w-full"
          />
        </div>

        {/* DESCRIPTION */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={game.description || ""}
            onChange={(e) =>
              setGame((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Describe this game..."
            className="border p-2 rounded w-full"
            rows={3}
          />
        </div>

        {/* PIN */}
        <div className="space-y-2">
          <label className="text-sm font-medium">PIN Protection</label>

          {editingPin ? (
            <div className="flex gap-2">
              <input
                ref={pinRef}
                type="text"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                placeholder="Enter PIN (min 4 characters)"
                className="border p-2 flex-1 rounded font-mono"
              />

              <button
                type="button"
                onClick={() => {
                  // draft only — handleSave updates sessionStorage AFTER success
                  setGame((prev) => ({ ...prev, pin: pinValue }));

                  // if they typed a pin (non-empty), stop ignoring storage
                  if ((pinValue || "").trim()) setIgnoreStoredPin(false);
                  else setIgnoreStoredPin(true);

                  setEditingPin(false);
                }}
                className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
                title="Apply (draft)"
              >
                <Check size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  const sessionPin2 = !ignoreStoredPin ? getStoredPin?.() || "" : "";
                  setPinValue(game.pin || sessionPin2 || "");
                  setEditingPin(false);
                }}
                className="bg-gray-400 text-white px-3 py-2 rounded hover:bg-gray-500"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              {pinValue ? (
                <span className="font-mono text-sm bg-gray-100 border px-3 py-2 rounded text-gray-800">
                  {pinValue}
                </span>
              ) : hasPin ? (
                <span className="text-sm text-gray-400 italic px-3 py-2">
                  PIN set (not returned by server)
                </span>
              ) : (
                <span className="text-sm text-gray-400 px-3 py-2">
                  No PIN set
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  // If user wants to edit/set, allow using stored pin again as a starting point
                  setIgnoreStoredPin(false);

                  const sessionPin2 = getStoredPin?.() || "";
                  setPinValue(game.pin || sessionPin2 || "");
                  setEditingPin(true);
                  setTimeout(() => pinRef.current?.focus(), 0);
                }}
                className="border px-3 py-2 rounded hover:bg-gray-100"
              >
                {hasPin ? "🔒 Change PIN" : "🔓 Set PIN"}
              </button>

              {hasPin && (
                <button
                  type="button"
                  onClick={handleRemovePin}
                  className="text-red-600 hover:text-red-800 px-3 py-2"
                >
                  Remove PIN
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500">
            After changing/removing the PIN, click Save Draft/Publish to apply it.
            (Auth still uses the old stored PIN until the save succeeds.)
          </p>
        </div>
      </div>

      {/* LEVELS */}
      <div className="bg-white p-5 rounded border space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Levels</h2>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowStorylineEditor(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-sm rounded hover:bg-gray-300"
            >
              <BookOpen size={16} />
              Storyline
            </button>

            <button
              type="button"
              onClick={() => setShowAddLevel(!showAddLevel)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Level
            </button>
          </div>
        </div>

        {showAddLevel && (
          <div className="border border-blue-200 rounded p-3 bg-blue-50 space-y-3">
            {Object.keys(allAvailableLevels).length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  Available Levels
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(allAvailableLevels)
                    .filter(([levelId]) => !(game.levelIds ?? []).includes(levelId))
                    .map(([levelId, levelData]) => (
                      <button
                        type="button"
                        key={levelId}
                        onClick={() => {
                          addLevel(levelId);
                          setShowAddLevel(false);
                        }}
                        className="px-3 py-1.5 text-sm bg-white border rounded hover:bg-blue-100 hover:border-blue-400 transition-colors"
                      >
                        {levelData.name || levelId}
                      </button>
                    ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Or enter Level ID manually
              </p>
              <div className="flex gap-2">
                <input
                  autoFocus={Object.keys(allAvailableLevels).length === 0}
                  placeholder="Level ID (e.g. level_3)"
                  value={newLevelId}
                  onChange={(e) => setNewLevelId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddLevel();
                    if (e.key === "Escape") setShowAddLevel(false);
                  }}
                  className="border p-2 rounded flex-1 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddLevel}
                  disabled={!newLevelId.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddLevel(false);
                    setNewLevelId("");
                  }}
                  className="px-3 py-2 bg-gray-200 rounded text-sm hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {(game.levelIds ?? []).length === 0 && !showAddLevel && (
          <p className="text-sm text-gray-400 text-center py-4">
            No levels yet. Click "Add Level" to get started.
          </p>
        )}

        {(game.levelIds ?? []).map((levelId, index) => {
          const levelData = getLevelData(levelId);

          return (
            <div key={levelId} className="border rounded">
              <div
                className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpandLevel(levelId)}
              >
                <div>
                  <span className="font-medium text-sm">
                    {levelData.name || levelId}
                  </span>
                  {levelData.name && (
                    <span className="ml-2 text-xs text-gray-400">({levelId})</span>
                  )}
                </div>

                <div className="flex gap-2 items-center">
                  <MoveUp
                    size={18}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLevel(index, -1);
                    }}
                    className={`cursor-pointer ${
                      index === 0
                        ? "opacity-30 pointer-events-none"
                        : "hover:text-blue-600"
                    }`}
                  />
                  <MoveDown
                    size={18}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLevel(index, 1);
                    }}
                    className={`cursor-pointer ${
                      index === (game.levelIds ?? []).length - 1
                        ? "opacity-30 pointer-events-none"
                        : "hover:text-blue-600"
                    }`}
                  />
                  <Trash2
                    size={18}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLevel(index);
                    }}
                    className="cursor-pointer text-red-500 hover:text-red-700"
                  />
                </div>
              </div>

              {expandedLevel === levelId && levelData && (
                <div className="border-t px-3 pb-3 pt-2 bg-gray-50 text-sm text-gray-600 space-y-1">
                  {levelData.description ? (
                    <p>{levelData.description}</p>
                  ) : (
                    <p className="italic text-gray-400">No description.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 justify-center pb-8">
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={savingGame}
          className="bg-gray-800 text-white px-5 py-2 rounded hover:bg-gray-900 disabled:opacity-50"
        >
          {savingGame ? "Saving..." : "Save Draft"}
        </button>

        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={savingGame}
          className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {savingGame ? "Publishing..." : "Publish"}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={savingGame}
          className="bg-red-600 text-white px-5 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {showStorylineEditor && (
        <StorylineEditor
          game={game}
          setGame={setGame}
          onClose={() => setShowStorylineEditor(false)}
        />
      )}
    </div>
  );
}
