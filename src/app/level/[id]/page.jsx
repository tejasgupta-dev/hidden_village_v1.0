"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Check, X, Plus, Trash2, Camera } from "lucide-react";
import { useLevelEditor } from "@/lib/hooks/useLevelEditor";
import PoseCapture from "@/components/Pose/poseCapture";

export default function LevelEditPage() {
  const params = useParams();
  const { user } = useAuth();

  const levelId = params.id;

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
  } = useLevelEditor(levelId, false, user?.email); // isNew = false for edit

  const [editingPin, setEditingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [showPoseCapture, setShowPoseCapture] = useState(false);

  const pinRef = useRef(null);

  // Sync pinValue with level.pin when level loads
  useEffect(() => {
    if (level.pin) {
      setPinValue(level.pin);
    }
  }, [level.pin]);

  if (loadingLevel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading level...</div>
      </div>
    );
  }

  if (!level) return null;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Level</h1>

      {message && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded mb-3">
          {message}
        </div>
      )}

      {/* NAME */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Level Name *</label>
        <input
          value={level.name || ""}
          onChange={(e) => setLevel((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Enter level name"
          className="border p-2 w-full rounded"
        />
      </div>

      {/* KEYWORDS */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Keywords</label>
        <input
          value={level.keywords || ""}
          onChange={(e) => setLevel((prev) => ({ ...prev, keywords: e.target.value }))}
          placeholder="puzzle, challenge, easy"
          className="border p-2 w-full rounded"
        />
      </div>

      {/* DESCRIPTION */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={level.description || ""}
          onChange={(e) => setLevel((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Describe this level..."
          className="border p-2 w-full rounded"
          rows={3}
        />
      </div>

      {/* QUESTION */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Question</label>
        <textarea
          value={level.question || ""}
          onChange={(e) => setLevel((prev) => ({ ...prev, question: e.target.value }))}
          placeholder="What question should players answer?"
          className="border p-2 w-full rounded"
          rows={2}
        />
      </div>

      {/* PIN */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">PIN Protection</label>
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
            <button
              onClick={() => {
                setLevel((prev) => ({ ...prev, pin: pinValue }));
                setEditingPin(false);
              }}
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => {
                setPinValue(level.pin || "");
                setEditingPin(false);
              }}
              className="bg-gray-400 text-white px-3 py-2 rounded hover:bg-gray-500"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPinValue(level.pin || "");
                setEditingPin(true);
                setTimeout(() => pinRef.current?.focus(), 0);
              }}
              className="border px-3 py-2 rounded hover:bg-gray-100"
            >
              {level.pin ? "🔒 Change PIN" : "🔓 Set PIN"}
            </button>
            {level.pin && (
              <button
                onClick={() => setLevel((prev) => ({ ...prev, pin: "" }))}
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
          onClick={() => setShowPoseCapture(!showPoseCapture)}
          className="bg-purple-600 text-white px-3 py-2 rounded mb-2 flex items-center gap-2 hover:bg-purple-700"
        >
          <Camera size={16} />
          {showPoseCapture ? "Hide Pose Capture" : "Capture Pose"}
        </button>

        {showPoseCapture && (
          <div className="mb-3">
            <PoseCapture
              poses={level.poses || {}}
              onPosesUpdate={(poses) => setLevel((prev) => ({ ...prev, poses }))}
            />
          </div>
        )}

        {level.poses && Object.keys(level.poses).length > 0 && (
          <div className="space-y-2">
            {Object.entries(level.poses).map(([key, val]) => (
              <div key={key} className="flex gap-2 items-center">
                <span className="text-sm text-gray-600 w-32 truncate">{key}:</span>
                <input
                  value={typeof val === "string" ? val : JSON.stringify(val)}
                  disabled
                  className="border p-2 flex-1 bg-gray-50 rounded text-sm"
                />
                <button
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

        {level.options && level.options.length > 0 ? (
          <div className="space-y-2 mb-3">
            {level.options.map((opt, i) => (
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
                    checked={level.answers && level.answers.includes(i)}
                    onChange={() => toggleAnswer(i)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Correct</span>
                </label>

                <button
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
          {savingLevel ? "Saving..." : "Save Draft"}
        </button>

        <button
          disabled={savingLevel}
          onClick={() => handleSave(true)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingLevel ? "Publishing..." : "Publish"}
        </button>

        <button
          disabled={savingLevel}
          onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Delete
        </button>

        <button onClick={handleBack} className="border px-4 py-2 rounded hover:bg-gray-100">
          Back
        </button>

        <div className="ml-auto text-sm text-gray-600">
          Status: {level.isPublished ? "✅ Published" : "📝 Draft"}
        </div>
      </div>
    </div>
  );
}