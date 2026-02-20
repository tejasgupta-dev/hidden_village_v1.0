"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Check, X, Plus, Trash2 } from "lucide-react";

import { useLevelEditor } from "@/lib/hooks/useLevelEditor";

import LevelBasicsForm from "@/components/level/LevelBasicsForm";
import LevelPosesEditor from "@/components/level/LevelPosesEditor";
import FormField from "@/components/editor/FormField";

function asArray(v) {
  return Array.isArray(v) ? v : [];
}
function asObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

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

  const safeLevel = useMemo(() => level ?? {}, [level]);
  const poses = useMemo(() => asObject(safeLevel.poses), [safeLevel.poses]);
  const options = useMemo(() => asArray(safeLevel.options), [safeLevel.options]);
  const answers = useMemo(() => asArray(safeLevel.answers), [safeLevel.answers]);

  const patchLevel = (patch) => {
    setLevel((prev) => ({ ...(prev ?? {}), ...(patch ?? {}) }));
  };

  // ----- PIN UI (optional)
  const [editingPin, setEditingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const pinRef = useRef(null);

  useEffect(() => {
    if (!editingPin) setPinValue(safeLevel.pin || "");
  }, [safeLevel.pin, editingPin]);

  if (loadingLevel || !level) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Create New Level</h1>

      {message && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded">
          {message}
        </div>
      )}

      {/* BASICS (uses FormField internally -> readable text) */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="text-sm font-semibold mb-3 text-gray-900">Basics</div>
        <LevelBasicsForm
          level={safeLevel}
          disabled={savingLevel}
          onChange={(patch) => patchLevel(patch)}
          errors={{}}
        />
      </div>

      {/* PIN (uses FormField -> readable) */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="text-sm font-semibold mb-2 text-gray-900">PIN Protection (Optional)</div>

        {editingPin ? (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <FormField
                id="level-pin"
                label="PIN"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                placeholder="Enter PIN (min 4 characters)"
                disabled={savingLevel}
                // type=password makes it hard to see; keep password if you want
                type="password"
              />
            </div>

            <button
              type="button"
              disabled={savingLevel}
              onClick={() => {
                patchLevel({ pin: pinValue, pinDirty: true });
                setEditingPin(false);
              }}
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              title="Apply (draft)"
            >
              <Check size={16} />
            </button>

            <button
              type="button"
              disabled={savingLevel}
              onClick={() => {
                setPinValue(safeLevel.pin || "");
                setEditingPin(false);
              }}
              className="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 disabled:opacity-50"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2 items-center">
            <div className="text-sm text-gray-700">
              {safeLevel.pin ? (
                <span className="font-mono bg-gray-50 border px-3 py-2 rounded inline-block text-gray-900">
                  {safeLevel.pin}
                </span>
              ) : (
                <span className="text-gray-500">No PIN set</span>
              )}
            </div>

            <button
              type="button"
              disabled={savingLevel}
              onClick={() => {
                setPinValue(safeLevel.pin || "");
                setEditingPin(true);
                setTimeout(() => pinRef.current?.focus?.(), 0);
              }}
              className="border px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-50 text-gray-900"
            >
              {safeLevel.pin ? "🔒 Change PIN" : "🔓 Set PIN"}
            </button>

            {safeLevel.pin && (
              <button
                type="button"
                disabled={savingLevel}
                onClick={() => {
                  patchLevel({ pin: "", pinDirty: true });
                  setPinValue("");
                  setEditingPin(false);
                }}
                className="text-red-600 hover:text-red-700 px-3 py-2 disabled:opacity-50"
              >
                Remove PIN
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          PIN changes apply when you save/publish.
        </p>
      </div>

      {/* POSES (uses your LevelPosesEditor which uses PoseCapture internally) */}
      <div className="border rounded-xl p-4 bg-white">
        <LevelPosesEditor
          poses={poses}
          disabled={savingLevel}
          onPosesUpdate={(nextPoses) => patchLevel({ poses: nextPoses })}
          onRemovePose={(poseId) => removePose?.(poseId)}
        />
      </div>

      {/* OPTIONS & ANSWERS */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="text-sm font-semibold mb-3 text-gray-900">Options & Answers</div>

        {options.length > 0 ? (
          <div className="space-y-2 mb-3">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-sm text-gray-600 w-8">{i + 1}.</span>

                {/* Force readable input even if parent text color changes */}
                <input
                  value={opt ?? ""}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="border p-2 flex-1 rounded bg-white text-gray-900 placeholder:text-gray-400"
                  disabled={savingLevel}
                />

                <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={answers.includes(i)}
                    onChange={() => toggleAnswer(i)}
                    className="h-4 w-4"
                    disabled={savingLevel}
                  />
                  <span className="text-sm text-gray-900">Correct</span>
                </label>

                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={savingLevel}
                  className="bg-red-600 text-white px-2 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                  title="Remove option"
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
          disabled={savingLevel}
          className="bg-blue-600 text-white px-3 py-2 rounded flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
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
          className="border px-4 py-2 rounded hover:bg-gray-50 text-gray-900"
          disabled={savingLevel}
        >
          Cancel
        </button>
      </div>

      <div className="mt-2 text-sm text-gray-600">
        * After creating, you&apos;ll be redirected to the edit page where you can
        continue working on your level.
      </div>
    </div>
  );
}
