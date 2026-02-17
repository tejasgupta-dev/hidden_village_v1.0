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
    removePose,
    addOption,
    updateOption,
    removeOption,
    toggleAnswer,
    handleSave,
    handleDelete,
    handleBack,
    getStoredPin,
  } = useLevelEditor(levelId, false, user?.email);

  const [editingPin, setEditingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const pinRef = useRef(null);

  const [showPoseCapture, setShowPoseCapture] = useState(false);

  // suppress sessionStorage PIN being re-displayed after local remove
  const [ignoreStoredPin, setIgnoreStoredPin] = useState(false);

  /* ------------------ PIN SYNC (don’t overwrite while typing) ------------------ */
  useEffect(() => {
    if (!level) return;
    if (editingPin) return;

    if (ignoreStoredPin) {
      setPinValue((level.pin ?? "") || "");
      return;
    }

    const sessionPin = getStoredPin?.() || "";
    const localPin = level.pin ?? "";
    setPinValue(localPin || sessionPin || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level?.pin, levelId, editingPin, ignoreStoredPin]);

  useEffect(() => {
    if (!level) return;
    if (((level.pin ?? "") || "").trim()) setIgnoreStoredPin(false);
  }, [level]);

  const storedPin = !ignoreStoredPin ? (getStoredPin?.() || "") : "";

  const hasPin =
    Boolean(((level?.pin ?? "") || "").trim()) ||
    Boolean(level?.hasPin) ||
    Boolean((storedPin || "").trim());

  const handleRemovePin = () => {
    setLevel((prev) => ({
      ...prev,
      pin: "",
      pinDirty: true, // ✅ mark intent to remove
    }));
    setPinValue("");
    setEditingPin(false);
    setIgnoreStoredPin(true);
  };

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
          value={level.question || ""}
          onChange={(e) => setLevel((prev) => ({ ...prev, question: e.target.value }))}
          placeholder="What question should players answer?"
          className="border p-2 w-full rounded"
          rows={2}
        />
      </div>

      {/* PIN */}
      <div className="mb-4 space-y-2">
        <label className="block text-sm font-medium">PIN Protection</label>

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
                setLevel((prev) => ({
                  ...prev,
                  pin: pinValue,
                  pinDirty: true, // ✅ mark intent to set/change
                }));

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
                const localPin = level.pin ?? "";
                setPinValue(localPin || sessionPin2 || "");
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
              <span className="text-sm text-gray-400 px-3 py-2">No PIN set</span>
            )}

            <button
              type="button"
              onClick={() => {
                setIgnoreStoredPin(false);
                const sessionPin2 = getStoredPin?.() || "";
                const localPin = level.pin ?? "";
                setPinValue(localPin || sessionPin2 || "");
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

      {/* POSES */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Poses</label>

        <button
          type="button"
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
          type="button"
          disabled={savingLevel}
          onClick={() => handleSave(false)}
          className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingLevel ? "Saving..." : "Save Draft"}
        </button>

        <button
          type="button"
          disabled={savingLevel}
          onClick={() => handleSave(true)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingLevel ? "Publishing..." : "Publish"}
        </button>

        <button
          type="button"
          disabled={savingLevel}
          onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Delete
        </button>

        <button
          type="button"
          onClick={handleBack}
          className="border px-4 py-2 rounded hover:bg-gray-100"
        >
          Back
        </button>

        <div className="ml-auto text-sm text-gray-600">
          Status: {level.isPublished ? "✅ Published" : "📝 Draft"}
        </div>
      </div>
    </div>
  );
}
