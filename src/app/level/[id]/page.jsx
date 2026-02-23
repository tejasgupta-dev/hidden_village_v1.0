"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, X } from "lucide-react";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useLevelEditor } from "@/lib/hooks/useLevelEditor";

import EditorHeader from "@/components/editor/EditorHeader";
import SectionCard from "@/components/editor/SectionCard";
import FormField from "@/components/editor/FormField";

import LevelBasicsForm from "@/components/level/LevelBasicsForm";
import LevelOptionsEditor from "@/components/level/LevelOptionsEditor";
import LevelPosesEditor from "@/components/level/LevelPosesEditor";

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

  const safeLevel = useMemo(() => level ?? {}, [level]);

  const [editingPin, setEditingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const pinRef = useRef(null);

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
    setLevel((prev) => ({ ...prev, pin: "", pinDirty: true }));
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
      <EditorHeader title="Edit Level" subtitle={`Level ID: ${levelId}`} onBack={handleBack} />

      {message && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded mb-4">{message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Basics">
            <LevelBasicsForm
              level={safeLevel}
              disabled={savingLevel}
              onChange={(patch) => setLevel((prev) => ({ ...prev, ...patch }))}
            />
          </SectionCard>

          <SectionCard
            title="PIN Protection"
            description="After changing/removing the PIN, click Save Draft or Publish to apply it."
          >
            {editingPin ? (
              <div className="flex gap-2">
                <FormField
                  id="level-pin"
                  type="text"
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value)}
                  placeholder="Enter PIN (min 4 characters)"
                  disabled={savingLevel}
                  className="flex-1"
                  inputRef={pinRef}
                />

                <button
                  type="button"
                  onClick={() => {
                    setLevel((prev) => ({ ...prev, pin: pinValue, pinDirty: true }));
                    if ((pinValue || "").trim()) setIgnoreStoredPin(false);
                    else setIgnoreStoredPin(true);
                    setEditingPin(false);
                  }}
                  disabled={savingLevel}
                  className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-50"
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
                  disabled={savingLevel}
                  className="bg-gray-400 text-white px-3 py-2 rounded hover:bg-gray-500 disabled:opacity-50"
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
                  disabled={savingLevel}
                  className="border px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  {hasPin ? "🔒 Change PIN" : "🔓 Set PIN"}
                </button>

                {hasPin && (
                  <button
                    type="button"
                    onClick={handleRemovePin}
                    disabled={savingLevel}
                    className="text-red-600 hover:text-red-700 px-3 py-2 disabled:opacity-50"
                  >
                    Remove PIN
                  </button>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Options & Answers">
            <LevelOptionsEditor
              options={safeLevel.options || []}
              answers={safeLevel.answers || []}
              onAddOption={addOption}
              onUpdateOption={updateOption}
              onRemoveOption={removeOption}
              onToggleAnswer={toggleAnswer}
              disabled={savingLevel}
            />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Poses">
            <LevelPosesEditor
              poses={safeLevel.poses || {}}
              disabled={savingLevel}
              onPosesUpdate={(poses) => setLevel((prev) => ({ ...prev, poses }))}
              onRemovePose={removePose}
            />
          </SectionCard>

          <SectionCard title="Actions">
            <div className="space-y-3">
              <button
                type="button"
                disabled={savingLevel}
                onClick={() => handleSave(false)}
                className="w-full bg-gray-900 text-white px-4 py-2 rounded hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingLevel ? "Saving..." : "Save Draft"}
              </button>

              <button
                type="button"
                disabled={savingLevel}
                onClick={() => handleSave(true)}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingLevel ? "Publishing..." : "Publish"}
              </button>

              <button
                type="button"
                disabled={savingLevel}
                onClick={handleDelete}
                className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>

              <div className="text-sm text-gray-600">
                Status: {safeLevel.isPublished ? "✅ Published" : "📝 Draft"}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
