"use client";

import { useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  MoveUp,
  MoveDown,
  Trash2,
  Edit2,
  Plus,
  Check,
  X,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useGameEditor } from "@/lib/hooks/useGameEditor";

export default function GameEditor({ isNew = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const id = pathname.split("/").pop();

  const { user } = useAuth();
  const editRef = useRef(null);

  const {
    game,
    loadingGame,
    savingGame,
    allAvailableLevels,
    expandedLevel,
    showAddLevel,
    setShowAddLevel,
    editingField,
    editValue,
    setEditValue,
    startEditing,
    saveEdit,
    cancelEdit,
    addLevel,
    removeLevel,
    moveLevel,
    toggleExpandLevel,
    getLevelData,
    handleSave,
    handleDelete,
    handleBack,
  } = useGameEditor(id, isNew, user?.email);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editRef.current && !editRef.current.contains(event.target)) {
        saveEdit();
      }
    };

    if (editingField) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editingField, saveEdit]);

  if (loadingGame) {
    return (
      <p className="text-center text-blue-600 font-semibold py-12 text-xl">
        Loading game...
      </p>
    );
  }

  if (!game) {
    return (
      <p className="text-center text-red-600 font-semibold py-12 text-xl">
        Game not found.
      </p>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8 bg-white rounded-xl shadow-lg space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} /> Back to Games
        </button>

        <h2 className="text-3xl font-semibold text-center flex-1">
          {isNew ? "Create New Game" : "Editing Game"}
        </h2>

        <div className="flex-1"></div>
      </div>

      {/* GAME INFO */}
      <div className="space-y-6">
        <FieldEditor
          label="Name"
          value={game.name}
          editingField={editingField}
          fieldKey="name"
          editValue={editValue}
          setEditValue={setEditValue}
          startEditing={startEditing}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          editRef={editRef}
        />

        {/* Author */}
        <div className="flex gap-4 items-center">
          <label className="w-32 font-semibold text-gray-700">Author</label>
          <span className="text-gray-500">{game.author}</span>
        </div>

        <FieldEditor
          label="Description"
          value={game.description}
          editingField={editingField}
          fieldKey="description"
          editValue={editValue}
          setEditValue={setEditValue}
          startEditing={startEditing}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          editRef={editRef}
          isTextarea
        />

        <FieldEditor
          label="Keywords"
          value={game.keywords}
          editingField={editingField}
          fieldKey="keywords"
          editValue={editValue}
          setEditValue={setEditValue}
          startEditing={startEditing}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          editRef={editRef}
        />

        <FieldEditor
          label="PIN"
          value={game.pin}
          editingField={editingField}
          fieldKey="pin"
          editValue={editValue}
          setEditValue={setEditValue}
          startEditing={startEditing}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          editRef={editRef}
        />
      </div>

      {/* LEVELS */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-semibold text-gray-700">Levels</h3>

        <div className="flex gap-2">
          <button
            onClick={() => alert("Storyline editor coming soon!")}
            className="flex items-center gap-2 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            <BookOpen size={18} /> Edit Storyline
          </button>

          <button
            onClick={() => setShowAddLevel(!showAddLevel)}
            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus size={18} /> Add Level
          </button>
        </div>
      </div>

      {showAddLevel && (
        <div className="p-4 bg-gray-100 rounded space-y-2">
          <p className="font-semibold">Select a level to add:</p>

          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {Object.entries(allAvailableLevels).map(
              ([levelId, levelData]) => (
                <div
                  key={levelId}
                  className={`flex justify-between p-2 rounded border ${
                    game.levelIds.includes(levelId)
                      ? "bg-gray-200 border-gray-300 cursor-not-allowed opacity-50"
                      : "bg-white border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer"
                  }`}
                  onClick={() =>
                    !game.levelIds.includes(levelId) && addLevel(levelId)
                  }
                >
                  <span>{levelData.name || "Untitled Level"}</span>

                  {game.levelIds.includes(levelId) && (
                    <span className="text-green-600 font-semibold">
                      ✓ Added
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Level List */}
      <div className="space-y-2">
        {game.levelIds.length === 0 ? (
          <p className="text-center text-gray-500 italic py-8 bg-gray-100 rounded">
            No levels added yet. Click "Add Level" to get started.
          </p>
        ) : (
          game.levelIds.map((levelId, index) => {
            const levelData = getLevelData(levelId);

            return (
              <div key={levelId} className="border rounded bg-gray-100">
                <div
                  className="flex justify-between items-center p-4 bg-white cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpandLevel(levelId)}
                >
                  <span>
                    {levelData.name || "Untitled Level"}

                    {game.storyline[index]?.length > 0 && (
                      <span className="ml-2 text-gray-500 text-sm">
                        📖 {game.storyline[index].length} dialogue
                        {game.storyline[index].length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </span>

                  <div className="flex gap-2 items-center">
                    <MoveUp
                      size={20}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLevel(index, -1);
                      }}
                      className={
                        index === 0
                          ? "opacity-30 cursor-not-allowed"
                          : "cursor-pointer"
                      }
                    />

                    <MoveDown
                      size={20}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLevel(index, 1);
                      }}
                      className={
                        index === game.levelIds.length - 1
                          ? "opacity-30 cursor-not-allowed"
                          : "cursor-pointer"
                      }
                    />

                    <Trash2
                      size={20}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLevel(index);
                      }}
                      className="cursor-pointer"
                    />
                  </div>
                </div>

                {expandedLevel === levelId && (
                  <div className="p-4 bg-gray-200 text-sm font-mono max-h-96 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(levelData, null, 2)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap gap-4 mt-6">
        <button
          onClick={() => handleSave(false)}
          disabled={savingGame}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          💾 {savingGame ? "Saving..." : "Save Draft"}
        </button>

        <button
          onClick={() => handleSave(true)}
          disabled={savingGame}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          🚀 {savingGame ? "Publishing..." : "Publish"}
        </button>

        {!isNew && (
          <button
            onClick={handleDelete}
            disabled={savingGame}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            🗑 Delete Game
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------
   SAFE VALUE FORMATTER
-------------------------- */
function formatValue(val) {
  if (val == null || val === "") return "Click to edit";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") return JSON.stringify(val);
  return val;
}

/* --------------------------
   FIELD EDITOR
-------------------------- */
function FieldEditor({
  label,
  value,
  editingField,
  fieldKey,
  editValue,
  setEditValue,
  startEditing,
  saveEdit,
  cancelEdit,
  editRef,
  isTextarea = false,
}) {
  const handleKeyDown = (e) => {
    if (isTextarea) {
      if (e.key === "Enter" && e.ctrlKey) saveEdit();
      if (e.key === "Escape") cancelEdit();
    } else {
      if (e.key === "Enter") saveEdit();
      if (e.key === "Escape") cancelEdit();
    }
  };

  return (
    <div className="flex gap-4 items-start">
      <label className="w-32 font-semibold text-gray-700">{label}</label>

      <div className="flex-1 flex items-center gap-2 p-2 rounded border hover:border-gray-400 hover:bg-gray-50 min-h-[40px]">
        {editingField === fieldKey ? (
          <div ref={editRef} className="flex gap-2 flex-1">
            {isTextarea ? (
              <textarea
                className="flex-1 p-2 border-2 border-blue-600 rounded focus:outline-none"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            ) : (
              <input
                type="text"
                className="flex-1 p-2 border-2 border-blue-600 rounded focus:outline-none"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            )}

            <Check className="text-green-600 cursor-pointer" onClick={saveEdit} />
            <X className="text-red-600 cursor-pointer" onClick={cancelEdit} />
          </div>
        ) : (
          <>
            <span
              onDoubleClick={() => startEditing(fieldKey, value)}
              className={`flex-1 ${!value ? "text-gray-400 italic" : ""}`}
            >
              {formatValue(value)}
            </span>

            <Edit2
              className="text-blue-600 cursor-pointer"
              onClick={() => startEditing(fieldKey, value)}
            />
          </>
        )}
      </div>
    </div>
  );
}
