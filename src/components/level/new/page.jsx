"use client";

import React, { useMemo } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useLevelEditor } from "@/lib/hooks/useLevelEditor";

import EditorHeader from "@/components/editor/EditorHeader";
import SectionCard from "@/components/editor/SectionCard";
import FormField from "@/components/editor/FormField";

import LevelBasicsForm from "@/components/level/LevelBasicsForm";
import LevelOptionsEditor from "@/components/level/LevelOptionsEditor";
import LevelPosesEditor from "@/components/level/LevelPosesEditor";

export default function NewLevelPage() {
  const { user } = useAuth();

  const {
    level,
    setLevel,
    loadingLevel,
    savingLevel,
    message,
    addOption,
    updateOption,
    removeOption,
    toggleAnswer,
    handleSave,
    handleBack,
  } = useLevelEditor(null, true, user?.email);

  const safeLevel = useMemo(() => level ?? {}, [level]);

  if (loadingLevel || !level) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <EditorHeader
        title="Create New Level"
        subtitle="Build the prompt, answers, and poses for this level."
        onBack={handleBack}
      />

      {message && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded mb-4">
          {message}
        </div>
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
            description="Optional. If set, editing requires this PIN for non-owners/admins."
          >
            <FormField
              id="level-pin"
              type="password"
              placeholder="Optional"
              value={safeLevel.pin || ""}
              onChange={(e) => setLevel((prev) => ({ ...prev, pin: e.target.value }))}
              disabled={savingLevel}
              helper="Changes apply when you save (draft or publish)."
            />
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
            />
          </SectionCard>

          <SectionCard title="Actions">
            <div className="space-y-3">
              <button
                disabled={savingLevel}
                onClick={() => handleSave(false)}
                className="w-full bg-gray-900 text-white px-4 py-2 rounded hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingLevel ? "Creating..." : "Create Draft"}
              </button>

              <button
                disabled={savingLevel}
                onClick={() => handleSave(true)}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingLevel ? "Creating..." : "Create & Publish"}
              </button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full border px-4 py-2 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              After creating, you&apos;ll be redirected to the edit page.
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
