"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Check, X, Plus, Trash2, Camera } from "lucide-react";
import { useLevelEditor } from "@/lib/hooks/useLevelEditor";
import PoseCapture from "@/components/Pose/poseCapture";

export default function NewLevelPage() {
  const { user } = useAuth();

  const {
    level,
    setLevel,
    loadingLevel,
    savingLevel,
    message,
    removePose,
    addOption,
    updateOption,
    removeOption,
    toggleAnswer,
    handleSave,
    handleBack,
  } = useLevelEditor(null, true, user?.email);

  // Always work with a safe object (level can be null briefly)
  const safeLevel = useMemo(() => level ?? {}, [level]);

  const [editingPin, setEditingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [showPoseCapture, setShowPoseCapture] = useState(false);

  const pinRef = useRef(null);

  // Keep pinValue in sync with the current draft level pin (but don't fight typing)
  useEffect(() => {
    if (!editingPin) {
      setPinValue(safeLevel.pin || "");
    }
  }, [safeLevel.pin, editingPin]);

  if (loadingLevel || !level) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Create New Level</h1>

      {message && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded mb-3">
          {message}
        </div>
      )}

      {/* NAME */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Level Name *</label>
        <input
          value={safeLevel.name || ""}
          onChange={(e) => setLevel((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Enter level name"
          className="border p-2 w-full rounded"
        />
      </div>

      {/* KEYWORDS */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Keywords</label>
        <input
          value={safeLevel.keywords || ""}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, keywords: e.target.value }))
          }
          placeholder="puzzle, challenge, easy"
          className="border p-2 w-full rounded"
        />
      </div>

      {/* DESCRIPTION */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={safeLevel.description || ""}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Describe this level..."
          className="border p-2 w-full rounded"
          rows={3}
        />
      </div>

      {/* QUESTION */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Question</label>
        <textarea
          value={safeLevel.question || ""}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, question: e.target.value }))
          }
          placeholder="What question should players answer?"
          className="border p-2 w-full rounded"
          rows={2}
        />
      </div>

      {/* PIN */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          PIN Protection (Optional)
        </label>

        {editingPin ? (
          <div className="flex gap-2">
            <input
              ref={pinRef}
              type="password"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value)}
              placeholder="Enter PIN (min 4 characters)"
              className="border p-2 flex-1 rounded"
            />

            {/* Apply draft pin */}
            <button
              type="button"
              onClick={() => {
                setLevel((prev) => ({ ...prev, pin: pinValue }));
                setEditingPin(false);
              }}
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
              title="Apply (draft)"
            >
              <Check size={16} />
            </button>

            {/* Cancel: revert to saved draft pin */}
            <button
              type="button"
              onClick={() => {
                setPinValue(safeLevel.pin || "");
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
            <button
              type="button"
              onClick={() => {
                setPinValue(safeLevel.pin || "");
                setEditingPin(true);
                setTimeout(() => pinRef.current?.focus(), 0);
              }}
              className="border px-3 py-2 rounded hover:bg-gray-100"
            >
              {safeLevel.pin ? "🔒 Change PIN" : "🔓 Set PIN"}
            </button>

            {safeLevel.pin && (
              <button
                type="button"
                onClick={() => {
                  setLevel((prev) => ({ ...prev, pin: "" }));
                  setPinValue("");
                  setEditingPin(false);
                }}
                className="text-red-600 hover:text-red-800 px-3 py-2"
              >
                Remove PIN
              </button>
            )}
          </div>
        )}
      </div>

      {/* POSES */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Poses</label>

        <button
          type="button"
          onClick={() => setShowPoseCapture((s) => !s)}
          className="bg-purple-600 text-white px-3 py-2 rounded mb-2 flex items-center gap-2 hover:bg-purple-700"
        >
          <Camera size={16} />
          {showPoseCapture ? "Hide Pose Capture" : "Capture Pose"}
        </button>

        {showPoseCapture && (
          <div className="mb-3">
            <PoseCapture
              poses={safeLevel.poses || {}}
              onPosesUpdate={(poses) => setLevel((prev) => ({ ...prev, poses }))}
            />
          </div>
        )}

        {safeLevel.poses && Object.keys(safeLevel.poses).length > 0 && (
          <div className="space-y-2">
            {Object.entries(safeLevel.poses).map(([key, val]) => (
              <div key={key} className="flex gap-2 items-center">
                <span className="text-sm text-gray-600 w-32 truncate">{key}:</span>
                <input
                  value={typeof val === "string" ? val : JSON.stringify(val)}
                  disabled
                  className="border p-2 flex-1 bg-gray-50 rounded text-sm"
                />
                <button
                  type="button"
                  onClick={() => removePose(key)}
                  className="bg-red-600 text-white px-2 py-2 rounded hover:bg-red-700"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OPTIONS & ANSWERS */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Options & Answers</label>

        {safeLevel.options && safeLevel.options.length > 0 ? (
          <div className="space-y-2 mb-3">
            {safeLevel.options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-sm text-gray-600 w-8">{i + 1}.</span>

                <input
                  value={opt || ""}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="border p-2 flex-1 rounded"
                />

                <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={Array.isArray(safeLevel.answers) && safeLevel.answers.includes(i)}
                    onChange={() => toggleAnswer(i)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Correct</span>
                </label>

                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="bg-red-600 text-white px-2 py-2 rounded hover:bg-red-700"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm mb-3">No options added yet</p>
        )}

        <button
          type="button"
          onClick={addOption}
          className="bg-blue-600 text-white px-3 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={14} />
          Add Option
        </button>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 flex-wrap items-center">
        <button
          disabled={savingLevel}
          onClick={() => handleSave(false)}
          className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingLevel ? "Creating..." : "Create Draft"}
        </button>

        <button
          disabled={savingLevel}
          onClick={() => handleSave(true)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingLevel ? "Creating..." : "Create & Publish"}
        </button>

        <button
          type="button"
          onClick={handleBack}
          className="border px-4 py-2 rounded hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        * After creating, you&apos;ll be redirected to the edit page where you can
        continue working on your level.
      </div>
    </div>
  );
}
