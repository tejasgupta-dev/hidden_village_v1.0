"use client";

import React, { useMemo, useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useLevelEditor } from "@/lib/hooks/useLevelEditor";

import EditorHeader from "@/components/editor/EditorHeader";
import SectionCard from "@/components/editor/SectionCard";
import FormField from "@/components/editor/FormField";

import LevelBasicsForm from "@/components/level/LevelBasicsForm";
import LevelOptionsEditor from "@/components/level/LevelOptionsEditor";
import LevelPosesEditor from "@/components/level/LevelPosesEditor";

/* ------------------------------ DEFAULTS ------------------------------ */
const DEFAULT_SETTINGS = {
  logFPS: 15,

  include: {
    face: false,
    leftArm: true,
    rightArm: true,
    leftLeg: true,
    rightLeg: true,
    hands: false,
  },

  states: {
    intro: true,
    intuition: true,
    tween: true,
    poseMatch: false,
    insight: true,
    outro: true,
  },

  reps: {
    poseMatch: 2,
    tween: 2,
  },

  ui: {
    dialogueFontSize: 20,
  },
};

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, patch) {
  if (!isPlainObject(base)) return patch;
  if (!isPlainObject(patch)) return patch ?? base;

  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(base[k])) out[k] = deepMerge(base[k], v);
    else out[k] = v;
  }
  return out;
}

function clampNumber(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

/* ------------------------------ UI CLASSES ------------------------------ */
const numberClass =
  "w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-500 " +
  "focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 " +
  "disabled:bg-gray-100 disabled:text-black disabled:cursor-not-allowed disabled:opacity-70";

const primaryBtn =
  "w-full rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-black " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const greenBtn =
  "w-full rounded-xl bg-green-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-green-700 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

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

  /* ------------------------------ SETTINGS ------------------------------ */
  const safeSettings = useMemo(() => {
    const fromLevel = safeLevel.settings ?? {};
    return deepMerge(DEFAULT_SETTINGS, fromLevel);
  }, [safeLevel.settings]);

  const updateSettings = (patch) => {
    setLevel((prev) => {
      const prevSettings = deepMerge(DEFAULT_SETTINGS, prev?.settings ?? {});
      const nextSettings = deepMerge(prevSettings, patch);
      return { ...prev, settings: nextSettings };
    });
  };

  /* ------------------------------ POSE TOLERANCE MAP ------------------------------ */
  const poseTolMap = useMemo(() => safeLevel.poseTolerancePctById || {}, [safeLevel.poseTolerancePctById]);

  const updatePoseTolMap = (nextMap) => {
    setLevel((prev) => ({ ...prev, poseTolerancePctById: nextMap }));
  };

  /* ------------------------------ PIN (new level) ------------------------------ */
  const [pinEditing, setPinEditing] = useState(false);

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
        subtitle="Build the prompt, answers, poses, and settings."
        onBack={handleBack}
      />

      {message && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded mb-4">{message}</div>
      )}

      {/* ✅ Full-width poses like the edit page */}
      <SectionCard
        title="Poses"
        description="Capture poses and set per-pose tolerance. Previews are always visible."
      >
        <div className="min-h-[560px]">
          <LevelPosesEditor
            poses={safeLevel.poses || {}}
            disabled={savingLevel}
            onPosesUpdate={(poses) => setLevel((prev) => ({ ...prev, poses }))}
            poseTolerancePctById={poseTolMap}
            onPoseToleranceUpdate={updatePoseTolMap}
          />
        </div>
      </SectionCard>

      <div className="h-4" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MAIN */}
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {safeLevel.pin ? (
                    <span className="font-mono text-xs bg-gray-100 border px-2 py-1 rounded text-black">
                      {pinEditing ? safeLevel.pin : "••••••••"}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">No PIN set</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setPinEditing((v) => !v)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                  disabled={savingLevel}
                >
                  {pinEditing ? "Hide" : safeLevel.pin ? "Edit" : "Set PIN"}
                </button>
              </div>

              {pinEditing && (
                <FormField
                  id="level-pin"
                  type="text"
                  placeholder="Optional (min 4 chars recommended)"
                  value={safeLevel.pin || ""}
                  onChange={(e) => setLevel((prev) => ({ ...prev, pin: e.target.value }))}
                  disabled={savingLevel}
                  helper="Applies when you create (draft or publish)."
                />
              )}
            </div>
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

        {/* SIDEBAR */}
        <div className="space-y-4">
          <SectionCard
            title="Settings"
            description="Stored on the level (level.settings). Defaults are applied automatically."
          >
            <div className="space-y-4">
              {/* logFPS */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900">Logging</div>
                <div className="flex items-center gap-3">
                  <label htmlFor="log-fps" className="text-sm text-gray-700 w-28">
                    logFPS
                  </label>
                  <input
                    id="log-fps"
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={safeSettings.logFPS}
                    disabled={savingLevel}
                    onChange={(e) =>
                      updateSettings({
                        logFPS: clampNumber(e.target.value, 1, 120, DEFAULT_SETTINGS.logFPS),
                      })
                    }
                    className={numberClass}
                  />
                </div>
              </div>

              <div className="h-px bg-gray-100" />

              {/* include */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900">Similarity includes</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(safeSettings.include).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={!!val}
                        disabled={savingLevel}
                        onChange={(e) => updateSettings({ include: { [key]: e.target.checked } })}
                        className="h-4 w-4"
                      />
                      <span className="capitalize">{key}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="h-px bg-gray-100" />

              {/* states */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900">States enabled</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(safeSettings.states).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={!!val}
                        disabled={savingLevel}
                        onChange={(e) => updateSettings({ states: { [key]: e.target.checked } })}
                        className="h-4 w-4"
                      />
                      <span className="capitalize">{key}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="h-px bg-gray-100" />

              {/* reps */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900">Repetitions</div>

                <div className="flex items-center gap-3">
                  <label htmlFor="rep-posematch" className="text-sm text-gray-700 w-28">
                    poseMatch
                  </label>
                  <input
                    id="rep-posematch"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={safeSettings.reps.poseMatch}
                    disabled={savingLevel}
                    onChange={(e) =>
                      updateSettings({
                        reps: {
                          poseMatch: clampNumber(
                            e.target.value,
                            1,
                            20,
                            DEFAULT_SETTINGS.reps.poseMatch
                          ),
                        },
                      })
                    }
                    className={numberClass}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label htmlFor="rep-tween" className="text-sm text-gray-700 w-28">
                    tween
                  </label>
                  <input
                    id="rep-tween"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={safeSettings.reps.tween}
                    disabled={savingLevel}
                    onChange={(e) =>
                      updateSettings({
                        reps: {
                          tween: clampNumber(
                            e.target.value,
                            1,
                            20,
                            DEFAULT_SETTINGS.reps.tween
                          ),
                        },
                      })
                    }
                    className={numberClass}
                  />
                </div>
              </div>

              <div className="h-px bg-gray-100" />

              {/* ui */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900">UI</div>
                <div className="flex items-center gap-3">
                  <label htmlFor="dialogue-font-size" className="text-sm text-gray-700 w-28">
                    dialogueFontSize
                  </label>
                  <input
                    id="dialogue-font-size"
                    type="number"
                    min={10}
                    max={64}
                    step={1}
                    value={safeSettings.ui.dialogueFontSize}
                    disabled={savingLevel}
                    onChange={(e) =>
                      updateSettings({
                        ui: {
                          dialogueFontSize: clampNumber(
                            e.target.value,
                            10,
                            64,
                            DEFAULT_SETTINGS.ui.dialogueFontSize
                          ),
                        },
                      })
                    }
                    className={numberClass}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Actions">
            <div className="space-y-3">
              <button
                type="button"
                disabled={savingLevel}
                onClick={() => handleSave(false)}
                className={primaryBtn}
              >
                {savingLevel ? "Creating..." : "Create Draft"}
              </button>

              <button
                type="button"
                disabled={savingLevel}
                onClick={() => handleSave(true)}
                className={greenBtn}
              >
                {savingLevel ? "Creating..." : "Create & Publish"}
              </button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
                disabled={savingLevel}
              >
                Cancel
              </button>

              <div className="text-sm text-gray-600">
                Status: <span className="text-gray-700">🆕 New (not created yet)</span>
              </div>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              After creating, you&apos;ll be redirected to the edit page.
            </p>
          </SectionCard>
        </div>
      </div>

      {/* Ensure nested inputs render black text */}
      <style jsx global>{`
        input,
        textarea,
        select {
          color: #000 !important;
        }
      `}</style>
    </div>
  );
}