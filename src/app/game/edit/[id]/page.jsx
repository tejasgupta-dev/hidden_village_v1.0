"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  MoveUp,
  MoveDown,
  Trash2,
  Plus,
  ArrowLeft,
  BookOpen,
  Edit,
  Check,
  X,
} from "lucide-react";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useGameEditor } from "@/lib/hooks/useGameEditor";
import StorylineEditor from "@/components/storylineEditor";

/* ======================================================
   EDITABLE FIELD COMPONENT
====================================================== */

function EditableField({
  label,
  field,
  value,
  onSave,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const startEditing = () => {
    setEditValue(value);
    setIsEditing(true);
  };

  const saveEdit = () => {
    onSave(field, editValue);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>

      {isEditing ? (
        <div className="flex gap-2 items-center">
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            autoFocus
            className="border p-2 rounded w-full"
          />
          <Check
            className="cursor-pointer text-green-600 shrink-0"
            onClick={saveEdit}
          />
          <X
            className="cursor-pointer text-red-600 shrink-0"
            onClick={cancelEdit}
          />
        </div>
      ) : (
        <div className="flex justify-between items-center border p-2 rounded">
          <span className="text-sm">{value || "—"}</span>
          <Edit
            className="cursor-pointer text-gray-400 hover:text-gray-700 shrink-0"
            size={16}
            onClick={startEditing}
          />
        </div>
      )}
    </div>
  );
}

/* ======================================================
   GAME EDITOR
====================================================== */

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
  } = useGameEditor(id, false, user?.email);

  // UI-specific state
  const [showStorylineEditor, setShowStorylineEditor] = useState(false);
  const [showAddLevel, setShowAddLevel] = useState(false);
  const [newLevelId, setNewLevelId] = useState("");
  const [expandedLevel, setExpandedLevel] = useState(null);

  /* -------------------------------------------------------
     HANDLERS
  ------------------------------------------------------- */

  const handleBack = () => {
    router.push("/");
  };

  const handleFieldSave = (field, value) => {
    setGame((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddLevel = () => {
    const trimmed = newLevelId.trim();
    if (!trimmed) return;
    addLevel(trimmed);
    setNewLevelId("");
    setShowAddLevel(false);
  };

  const moveLevel = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= (game.levelIds ?? []).length) return;

    setGame((prev) => {
      const newLevelIds = [...(prev.levelIds || [])];
      const newStoryline = [...(prev.storyline || [])];

      // Swap levels
      [newLevelIds[index], newLevelIds[newIndex]] = [
        newLevelIds[newIndex],
        newLevelIds[index],
      ];

      // Swap storyline
      [newStoryline[index], newStoryline[newIndex]] = [
        newStoryline[newIndex],
        newStoryline[index],
      ];

      return {
        ...prev,
        levelIds: newLevelIds,
        storyline: newStoryline,
      };
    });
  };

  const toggleExpandLevel = (levelId) => {
    setExpandedLevel((prev) => (prev === levelId ? null : levelId));
  };

  /* -------------------------------------------------------
     LOADING / NOT FOUND
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <div className="min-h-screen py-6 px-4 max-w-5xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <button
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
        <EditableField
          label="Game Name"
          field="name"
          value={game.name || ""}
          onSave={handleFieldSave}
        />
        <EditableField
          label="Description"
          field="description"
          value={game.description || ""}
          onSave={handleFieldSave}
        />
        <EditableField
          label="Keywords"
          field="keywords"
          value={game.keywords || ""}
          onSave={handleFieldSave}
        />
        <EditableField
          label="PIN"
          field="pin"
          value={game.pin || ""}
          onSave={handleFieldSave}
        />
      </div>

      {/* LEVELS */}
      <div className="bg-white p-5 rounded border space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Levels</h2>

          <div className="flex gap-2">
            <button
              onClick={() => setShowStorylineEditor(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-sm rounded hover:bg-gray-300"
            >
              <BookOpen size={16} />
              Storyline
            </button>

            <button
              onClick={() => setShowAddLevel(!showAddLevel)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Level
            </button>
          </div>
        </div>

        {/* ADD LEVEL PANEL */}
        {showAddLevel && (
          <div className="border border-blue-200 rounded p-3 bg-blue-50 space-y-3">
            {/* Levels from allAvailableLevels */}
            {Object.keys(allAvailableLevels).length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  Available Levels
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(allAvailableLevels)
                    .filter(
                      ([levelId]) => !(game.levelIds ?? []).includes(levelId)
                    )
                    .map(([levelId, levelData]) => (
                      <button
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
                {Object.keys(allAvailableLevels).every((levelId) =>
                  (game.levelIds ?? []).includes(levelId)
                ) && (
                  <p className="text-sm text-gray-400 italic">
                    All available levels have been added.
                  </p>
                )}
              </div>
            ) : null}

            {/* Manual entry fallback */}
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
                  onClick={handleAddLevel}
                  disabled={!newLevelId.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700"
                >
                  Add
                </button>
                <button
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

        {/* LEVEL LIST */}
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
                    <span className="ml-2 text-xs text-gray-400">
                      ({levelId})
                    </span>
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

              {/* EXPANDED LEVEL DETAILS */}
              {expandedLevel === levelId && levelData && (
                <div className="border-t px-3 pb-3 pt-2 bg-gray-50 text-sm text-gray-600 space-y-1">
                  {levelData.description && <p>{levelData.description}</p>}
                  {!levelData.description && (
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
          onClick={() => handleSave(false)}
          disabled={savingGame}
          className="bg-gray-800 text-white px-5 py-2 rounded hover:bg-gray-900 disabled:opacity-50"
        >
          {savingGame ? "Saving..." : "Save Draft"}
        </button>

        <button
          onClick={() => handleSave(true)}
          disabled={savingGame}
          className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Publish
        </button>

        <button
          onClick={handleDelete}
          className="bg-red-600 text-white px-5 py-2 rounded hover:bg-red-700"
        >
          Delete
        </button>
      </div>

      {/* STORYLINE EDITOR MODAL */}
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