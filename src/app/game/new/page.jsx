"use client";

import { useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useLevelEditor } from "@/lib/hooks/useLevelEditor";
import { Check, X } from "lucide-react";

export default function NewLevel() {
  const { user } = useAuth();
  const editRef = useRef(null);

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
  } = useLevelEditor(null, true, user?.email);

  if (loadingLevel)
    return <div className="text-center py-12 text-xl">Loading…</div>;

  if (!level) return null;

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Create New Level</h1>

      {message && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded">
          {message}
        </div>
      )}

      {/* Author */}
      <div>
        <label className="font-semibold">Author</label>
        <input
          className="w-full border p-2 rounded bg-gray-100"
          value={level.author || user?.email || ""}
          readOnly
        />
      </div>

      {/* Name */}
      <div>
        <label className="font-semibold">Name</label>
        <input
          className="w-full border p-2 rounded"
          value={level.name}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, name: e.target.value }))
          }
        />
      </div>

      {/* PIN */}
      <div>
        <label className="font-semibold">PIN</label>
        <input
          className="w-full border p-2 rounded"
          value={level.pin || ""}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, pin: e.target.value }))
          }
          placeholder="Optional"
        />
      </div>

      {/* Keywords */}
      <div>
        <label className="font-semibold">Keywords</label>
        <input
          className="w-full border p-2 rounded"
          value={level.keywords}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, keywords: e.target.value }))
          }
        />
      </div>

      {/* Description */}
      <div>
        <label className="font-semibold">Description</label>
        <textarea
          className="w-full border p-2 rounded"
          value={level.description}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, description: e.target.value }))
          }
        />
      </div>

      {/* POSES */}
      <div className="border p-3 rounded">
        <label className="font-semibold">Poses</label>

        {Object.entries(level.poses || {}).map(([key, val]) => (
          <div key={key} className="flex gap-2 mt-2">
            <input
              className="flex-1 border p-2 rounded"
              value={val}
              onChange={(e) => updatePose(key, e.target.value)}
            />
            <button
              className="px-3 py-1 bg-red-500 text-white rounded"
              onClick={() => removePose(key)}
            >
              X
            </button>
          </div>
        ))}

        <button
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
          onClick={addPose}
        >
          Add Pose
        </button>
      </div>

      {/* Question */}
      <div>
        <label className="font-semibold">Question</label>
        <textarea
          className="w-full border p-2 rounded"
          value={level.question}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, question: e.target.value }))
          }
        />
      </div>

      {/* OPTIONS */}
      <div className="border p-3 rounded">
        <label className="font-semibold">Options</label>

        {level.options.map((opt, i) => (
          <div key={i} className="flex gap-2 mt-2 items-center">
            <input
              className="flex-1 border p-2 rounded"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
            />

            <input
              type="checkbox"
              checked={level.answers.includes(i)}
              onChange={() => toggleAnswer(i)}
            />

            <button
              className="px-3 py-1 bg-red-500 text-white rounded"
              onClick={() => removeOption(i)}
            >
              X
            </button>
          </div>
        ))}

        <button
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
          onClick={addOption}
        >
          Add Option
        </button>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3">
        <button
          disabled={savingLevel}
          className="px-4 py-2 bg-gray-600 text-white rounded"
          onClick={() => handleSave(level.pin, false)}
        >
          Save Draft
        </button>

        <button
          disabled={savingLevel}
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={() => handleSave(level.pin, true)}
        >
          Publish
        </button>
      </div>
    </div>
  );
}
