"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Check, X, Plus, Trash2 } from "lucide-react";
import { useLevelEditor } from "@/lib/hooks/useLevelEditor";

export default function LevelEditor() {
  const params = useParams();
  const { user } = useAuth();

  const id = params.id;
  const isNew = id === "new";

  const {
    level,
    setLevel,
    loadingLevel,
    savingLevel,
    message,
    addPose,
    updatePose,
    removePose,
    addOption,
    updateOption,
    removeOption,
    toggleAnswer,
    handleSave,
    handleDelete,
    handleBack,
  } = useLevelEditor(id, isNew, user?.email);

  const [editingPin, setEditingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const pinRef = useRef(null);

  if (loadingLevel)
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-700 text-sm">Loading...</p>
        </div>
      </div>
    );

  if (!level) return null;

  return (
    <div className="min-h-screen bg-transparent py-4 px-3">
      <div className="max-w-3xl mx-auto">
        
        {/* HEADER */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">
          {isNew ? "Create Level" : "Edit Level"}
        </h1>
        <p className="text-sm text-gray-600 text-center mb-4">
          {level.author || user?.email || ""}
        </p>

        {message && (
          <div className="mb-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm text-center font-medium">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          
          {/* LEFT COLUMN */}
          <div className="space-y-3">
            
            {/* BASIC INFO */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Basic Info</h2>
              
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Name *</label>
                  <input
                    value={level.name}
                    onChange={(e) => setLevel((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-400 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Level name..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Keywords</label>
                  <input
                    value={level.keywords}
                    onChange={(e) => setLevel((prev) => ({ ...prev, keywords: e.target.value }))}
                    className="w-full border border-gray-400 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="yoga, balance..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={level.description}
                    onChange={(e) => setLevel((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full border border-gray-400 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Brief description..."
                  />
                </div>
              </div>
            </div>

            {/* PIN */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">PIN</h2>

              {editingPin ? (
                <div className="flex gap-2 items-center">
                  <input
                    ref={pinRef}
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setLevel((prev) => ({ ...prev, pin: pinValue }));
                        setEditingPin(false);
                      }
                      if (e.key === "Escape") setEditingPin(false);
                    }}
                    className="flex-1 border border-gray-400 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter PIN..."
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setLevel((prev) => ({ ...prev, pin: pinValue }));
                      setEditingPin(false);
                    }}
                    className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setEditingPin(false)}
                    className="p-1.5 bg-transparent text-gray-800 rounded hover:bg-transparent"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setPinValue(level.pin || "");
                    setEditingPin(true);
                  }}
                  className="px-3 py-1.5 bg-transparent border border-gray-400 text-gray-900 text-sm font-medium rounded hover:bg-transparent-200"
                >
                  {level.pin ? "Change PIN" : "Set PIN"}
                </button>
              )}
            </div>

            {/* POSES */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">Poses</h2>

              <div className="space-y-2 max-h-32 overflow-y-auto">
                {Object.entries(level.poses || {}).map(([key, val]) => (
                  <div className="flex gap-2 items-center" key={key}>
                    <input
                      value={val}
                      onChange={(e) => updatePose(key, e.target.value)}
                      className="flex-1 border border-gray-400 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Pose..."
                    />
                    <button
                      className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-600 hover:text-white"
                      onClick={() => removePose(key)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1.5"
                onClick={addPose}
              >
                <Plus size={14} />
                Add Pose
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-3">
            
            {/* QUESTION */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">Question</h2>
              <textarea
                rows={3}
                value={level.question}
                onChange={(e) => setLevel((prev) => ({ ...prev, question: e.target.value }))}
                className="w-full border border-gray-400 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Your question..."
              />
            </div>

            {/* OPTIONS */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">Options</h2>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {level.options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      className="flex-1 border border-gray-400 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Option ${i + 1}...`}
                    />
                    <input
                      type="checkbox"
                      checked={level.answers.includes(i)}
                      onChange={() => toggleAnswer(i)}
                      className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-2 focus:ring-blue-500"
                      title={level.answers.includes(i) ? "Correct" : "Incorrect"}
                    />
                    <button
                      className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-600 hover:text-white"
                      onClick={() => removeOption(i)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1.5"
                onClick={addOption}
              >
                <Plus size={14} />
                Add Option
              </button>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="mt-3 bg-white rounded-lg border border-gray-300 p-3">
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              disabled={savingLevel}
              className="px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleSave(pinValue, false)}
            >
              Save Draft
            </button>

            <button
              disabled={savingLevel}
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleSave(pinValue, true)}
            >
              Publish
            </button>

            {!isNew && (
              <button
                disabled={savingLevel}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDelete}
              >
                Delete
              </button>
            )}

            <button
              className="px-4 py-2 bg-white border border-gray-400 text-gray-900 text-sm font-semibold rounded hover:bg-transparent"
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