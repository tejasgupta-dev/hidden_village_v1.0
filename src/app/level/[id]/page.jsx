"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Plus, Trash2 } from "lucide-react";

import { useLevelEditor } from "@/lib/hooks/useLevelEditor";

import LevelBasicsForm from "@/components/level/LevelBasicsForm";
import LevelPosesEditor from "@/components/level/LevelPosesEditor";

function asArray(v) {
  return Array.isArray(v) ? v : [];
}
function asObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

/** super simple toggle row */
function ToggleRow({ label, value, onChange, disabled, helper }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {helper ? <div className="text-xs text-gray-600">{helper}</div> : null}
      </div>
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4"
      />
    </label>
  );
}

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
  } = useLevelEditor(levelId, false, user?.email);

  const safeLevel = level ?? {};
  const poses = useMemo(() => asObject(safeLevel.poses), [safeLevel.poses]);
  const options = useMemo(() => asArray(safeLevel.options), [safeLevel.options]);
  const answers = useMemo(() => asArray(safeLevel.answers), [safeLevel.answers]);

  const patchLevel = (patch) => {
    setLevel((prev) => ({ ...(prev ?? {}), ...(patch ?? {}) }));
  };

  if (loadingLevel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-900">Loading level...</div>
      </div>
    );
  }

  if (!level) return null;

  // ✅ Force readable inputs even under aggressive parent styling
  const optionInputClass =
    "border border-gray-300 p-2 flex-1 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 " +
    "disabled:bg-gray-100 disabled:text-gray-700 disabled:cursor-not-allowed " +
    "!text-gray-900";

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Level</h1>

      {message && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded">
          {message}
        </div>
      )}

      {/* BASICS */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="text-sm font-semibold mb-3 text-gray-900">Basics</div>
        <LevelBasicsForm
          level={safeLevel}
          disabled={savingLevel}
          onChange={(patch) => patchLevel(patch)}
          errors={{}}
        />
      </div>

      {/* SETTINGS */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="text-sm font-semibold mb-1 text-gray-900">Level Settings</div>
        <div className="text-xs text-gray-600 mb-3">
          Placeholder toggles (save with the level; wire them into gameplay later).
        </div>

        <div className="divide-y">
          <ToggleRow
            label="Shuffle options"
            helper="Randomize multiple-choice option order."
            value={safeLevel.shuffleOptions}
            disabled={savingLevel}
            onChange={(v) => patchLevel({ shuffleOptions: v })}
          />

          <ToggleRow
            label="Show hints"
            helper="Enable hint UI for this level."
            value={safeLevel.showHints}
            disabled={savingLevel}
            onChange={(v) => patchLevel({ showHints: v })}
          />

          <ToggleRow
            label="Allow skip"
            helper="Let players skip this level."
            value={safeLevel.allowSkip}
            disabled={savingLevel}
            onChange={(v) => patchLevel({ allowSkip: v })}
          />

          <ToggleRow
            label="Timed level"
            helper="Enable a timer (duration can be added later)."
            value={safeLevel.timedEnabled}
            disabled={savingLevel}
            onChange={(v) => patchLevel({ timedEnabled: v })}
          />
        </div>
      </div>

      {/* POSES */}
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
                <span className="text-sm text-gray-700 w-8">{i + 1}.</span>

                <input
                  value={opt ?? ""}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className={optionInputClass}
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
                  className="bg-red-600 text-white px-2 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                  disabled={savingLevel}
                  title="Remove option"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm mb-3">No options added yet</p>
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
          className="border px-4 py-2 rounded hover:bg-gray-50 text-gray-900"
          disabled={savingLevel}
        >
          Back
        </button>

        <div className="ml-auto text-sm text-gray-700">
          Status: {safeLevel.isPublished ? "✅ Published" : "📝 Draft"}
        </div>
      </div>
    </div>
  );
}
