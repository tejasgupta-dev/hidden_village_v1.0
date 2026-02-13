"use client";

import { useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Edit2,
  Plus,
  Check,
  X,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useGameEditor } from "@/lib/hooks/useGameEditor";

export default function NewGame() {
  const router = useRouter();
  const { user } = useAuth();
  const editRef = useRef(null);

  // Always creating new game
  const isNew = true;
  const id = null;

  const {
    game,
    loadingGame,
    savingGame,
    allAvailableLevels,
    showAddLevel,
    setShowAddLevel,
    editingField,
    editValue,
    setEditValue,
    startEditing,
    saveEdit,
    cancelEdit,
    addLevel,
    handleSave,
  } = useGameEditor(id, isNew, user?.email);

  // Auto-save when clicking outside inline editor
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} /> Back to Games
        </button>

        <h2 className="text-3xl font-semibold text-center flex-1">
          Create New Game
        </h2>

        <div className="flex-1"></div>
      </div>

      {/* Game Fields */}
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

        <div className="flex gap-4 items-center">
          <label className="w-32 font-semibold text-gray-700">Author</label>
          <span className="text-gray-500">
            {game.author || user?.email || "Unknown"}
          </span>
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

      {/* Levels */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-semibold text-gray-700">Levels</h3>

        <button
          onClick={() => setShowAddLevel(!showAddLevel)}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus size={18} /> Add Level
        </button>
      </div>

      {showAddLevel && (
        <div className="p-4 bg-gray-100 rounded space-y-2">
          <p className="font-semibold">Select a level to add:</p>

          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {Object.entries(allAvailableLevels).map(([levelId, levelData]) => (
              <div
                key={levelId}
                className="flex justify-between p-2 rounded border bg-white cursor-pointer hover:border-blue-500 hover:bg-blue-50"
                onClick={() => addLevel(levelId)}
              >
                <span>{levelData.name || "Untitled Level"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Buttons */}
      <div className="flex flex-wrap gap-4 mt-6">
        <button
          onClick={() => handleSave(null, false)}
          disabled={savingGame}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          💾 Save Draft
        </button>

        <button
          onClick={() => handleSave(null, true)}
          disabled={savingGame}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          🚀 Publish
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------
   Reusable Inline Field Editor
--------------------------------------------------- */

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
  return (
    <div className="flex gap-4 items-start">
      <label className="w-32 font-semibold text-gray-700">{label}</label>

      <div className="flex-1 flex items-center gap-2 p-2 rounded border">
        {editingField === fieldKey ? (
          <div ref={editRef} className="flex gap-2 flex-1">
            {isTextarea ? (
              <textarea
                className="flex-1 p-2 border rounded"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
            ) : (
              <input
                type="text"
                className="flex-1 p-2 border rounded"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
            )}

            <Check
              onClick={saveEdit}
              className="cursor-pointer text-green-600"
            />
            <X
              onClick={cancelEdit}
              className="cursor-pointer text-red-600"
            />
          </div>
        ) : (
          <>
            <span
              onDoubleClick={() => startEditing(fieldKey, value)}
              className="flex-1"
            >
              {value || "Click to edit"}
            </span>

            <Edit2
              onClick={() => startEditing(fieldKey, value)}
              className="cursor-pointer text-blue-600"
            />
          </>
        )}
      </div>
    </div>
  );
}
