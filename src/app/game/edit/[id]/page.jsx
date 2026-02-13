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
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-900 text-sm">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <p className="text-center text-gray-900 font-semibold py-12 text-xl">
        Game not found.
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-4 px-3">
      <div className="max-w-5xl mx-auto space-y-4">
        
        {/* HEADER */}
        <div className="bg-white rounded-lg border border-gray-300 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              <ArrowLeft size={18} /> Back
            </button>

            <h1 className="text-2xl font-bold text-gray-900 text-center flex-1">
              {isNew ? "Create Game" : "Edit Game"}
            </h1>

            <div className="w-20"></div>
          </div>
          
          <p className="text-sm text-gray-600 text-center mt-2">
            {game.author || user?.email || ""}
          </p>
        </div>

        {/* GAME INFO */}
        <div className="bg-white rounded-lg border border-gray-300 p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Game Info</h2>
          
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
        <div className="bg-white rounded-lg border border-gray-300 p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-gray-900">Levels</h2>

            <div className="flex gap-2">
              <button
                onClick={() => alert("Storyline editor coming soon!")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-900 text-sm rounded hover:bg-gray-300"
              >
                <BookOpen size={16} /> Storyline
              </button>

              <button
                onClick={() => setShowAddLevel(!showAddLevel)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                <Plus size={16} /> Add Level
              </button>
            </div>
          </div>

          {showAddLevel && (
            <div className="p-3 bg-gray-50 rounded border border-gray-300 mb-3">
              <p className="font-semibold text-gray-900 text-sm mb-2">Select a level to add:</p>

              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {Object.entries(allAvailableLevels).map(
                  ([levelId, levelData]) => (
                    <div
                      key={levelId}
                      className={`flex justify-between p-2 rounded border text-sm ${
                        game.levelIds.includes(levelId)
                          ? "bg-gray-200 border-gray-300 cursor-not-allowed opacity-50"
                          : "bg-white border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer"
                      }`}
                      onClick={() =>
                        !game.levelIds.includes(levelId) && addLevel(levelId)
                      }
                    >
                      <span className="text-gray-900">{levelData.name || "Untitled Level"}</span>

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
              <p className="text-center text-gray-500 italic py-8 bg-gray-50 rounded text-sm">
                No levels added yet. Click "Add Level" to get started.
              </p>
            ) : (
              game.levelIds.map((levelId, index) => {
                const levelData = getLevelData(levelId);

                return (
                  <div key={levelId} className="border border-gray-300 rounded bg-white">
                    <div
                      className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleExpandLevel(levelId)}
                    >
                      <span className="text-gray-900 text-sm">
                        {levelData.name || "Untitled Level"}

                        {game.storyline[index]?.length > 0 && (
                          <span className="ml-2 text-gray-500 text-xs">
                            📖 {game.storyline[index].length} dialogue
                            {game.storyline[index].length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </span>

                      <div className="flex gap-2 items-center text-gray-700">
                        <MoveUp
                          size={18}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLevel(index, -1);
                          }}
                          className={
                            index === 0
                              ? "opacity-30 cursor-not-allowed"
                              : "cursor-pointer hover:text-blue-600"
                          }
                        />

                        <MoveDown
                          size={18}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLevel(index, 1);
                          }}
                          className={
                            index === game.levelIds.length - 1
                              ? "opacity-30 cursor-not-allowed"
                              : "cursor-pointer hover:text-blue-600"
                          }
                        />

                        <Trash2
                          size={18}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLevel(index);
                          }}
                          className="cursor-pointer hover:text-red-600"
                        />
                      </div>
                    </div>

                    {expandedLevel === levelId && (
                      <div className="p-3 bg-gray-50 border-t border-gray-300 text-xs font-mono max-h-96 overflow-auto whitespace-pre-wrap text-gray-900">
                        {JSON.stringify(levelData, null, 2)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="bg-white rounded-lg border border-gray-300 p-3">
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => handleSave(false)}
              disabled={savingGame}
              className="px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingGame ? "Saving..." : "Save Draft"}
            </button>

            <button
              onClick={() => handleSave(true)}
              disabled={savingGame}
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingGame ? "Publishing..." : "Publish"}
            </button>

            {!isNew && (
              <button
                onClick={handleDelete}
                disabled={savingGame}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            )}

            <button
              className="px-4 py-2 bg-white border border-gray-400 text-gray-900 text-sm font-semibold rounded hover:bg-gray-50"
              onClick={handleBack}
            >
              Back
            </button>
          </div>
        </div>
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
    <div className="flex gap-3 items-start">
      <label className="w-28 text-xs font-semibold text-gray-900 pt-2">{label}</label>

      <div className="flex-1 flex items-center gap-2 p-2 rounded border border-gray-300 bg-white hover:border-gray-400 min-h-[40px]">
        {editingField === fieldKey ? (
          <div ref={editRef} className="flex gap-2 flex-1">
            {isTextarea ? (
              <textarea
                className="flex-1 p-2 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                rows={3}
              />
            ) : (
              <input
                type="text"
                className="flex-1 p-2 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            )}

            <Check className="text-green-600 cursor-pointer" size={20} onClick={saveEdit} />
            <X className="text-red-600 cursor-pointer" size={20} onClick={cancelEdit} />
          </div>
        ) : (
          <>
            <span
              onDoubleClick={() => startEditing(fieldKey, value)}
              className={`flex-1 text-sm cursor-pointer ${!value ? "text-gray-400 italic" : "text-gray-900"}`}
            >
              {formatValue(value)}
            </span>

            <Edit2
              className="text-blue-600 cursor-pointer"
              size={18}
              onClick={() => startEditing(fieldKey, value)}
            />
          </>
        )}
      </div>
    </div>
  );
}