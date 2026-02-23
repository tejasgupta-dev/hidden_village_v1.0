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

const dangerBtn =
  "w-full rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

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

    // pin gate (no prompt/alert in hook now)
    needsPin,
    pinError,
    submitPin,
    cancelPin,

    // settings helpers from hook
    safeSettings,
    updateSettings,
    resetSettings,

    // editor helpers
    removePose,
    addOption,
    updateOption,
    removeOption,
    toggleAnswer,

    // lifecycle
    handleSave,
    handleDelete,
    handleBack,

    // pin storage helper
    getStoredPin,
  } = useLevelEditor(levelId, false, user?.email);

  const safeLevel = useMemo(() => level ?? {}, [level]);

  /* ------------------------------ PIN UI (gate modal) ------------------------------ */
  const [pinGateValue, setPinGateValue] = useState("");
  const pinGateRef = useRef(null);

  useEffect(() => {
    if (!needsPin) return;
    const stored = getStoredPin?.() || "";
    setPinGateValue(stored);
    setTimeout(() => pinGateRef.current?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPin]);

  const handleSubmitGatePin = async (e) => {
    e?.preventDefault?.();
    await submitPin(pinGateValue);
  };

  /* ------------------------------ PIN (editor section) ------------------------------ */
  const [editingPin, setEditingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const pinRef = useRef(null);

  // suppress sessionStorage PIN being re-displayed after local remove
  const [ignoreStoredPin, setIgnoreStoredPin] = useState(false);

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

  const onClickDelete = async () => {
    if (!confirm("Delete this level?")) return;
    await handleDelete();
  };

  const onClickSaveDraft = async () => {
    const res = await handleSave(false);
    if (res?.success) alert("Draft saved!");
    else alert("Error saving level");
  };

  const onClickPublish = async () => {
    const res = await handleSave(true);
    if (res?.success) alert("Level published!");
    else alert("Error saving level");
  };

  if (loadingLevel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading level...</div>
      </div>
    );
  }

  // when gated, show the modal on top of the page
  // (we still render the page behind it so the layout doesn't jump)
  if (!level && !needsPin) return null;

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* ------------------------------ PIN GATE MODAL ------------------------------ */}
      {needsPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={cancelPin}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200">
            <div className="p-5">
              <div className="text-lg font-semibold text-gray-900">Enter PIN</div>
              <div className="mt-1 text-sm text-gray-600">
                This level is protected. Enter the PIN to continue.
              </div>

              <form onSubmit={handleSubmitGatePin} className="mt-4 space-y-3">
                <FormField
                  id="gate-pin"
                  label="PIN"
                  type="password"
                  value={pinGateValue}
                  onChange={(e) => setPinGateValue(e.target.value)}
                  placeholder="PIN"
                  disabled={savingLevel}
                  inputRef={pinGateRef}
                  error={pinError || ""}
                />

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={cancelPin} className="flex-1 border rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-black">
                    Unlock
                  </button>
                </div>

                {pinError && (
                  <div className="text-sm text-red-600">{pinError}</div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      <EditorHeader title="Edit Level" subtitle={`Level ID: ${levelId}`} onBack={handleBack} />

      {message && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded mb-4">{message}</div>
      )}

      {/* ✅ Poses gets full width */}
      <SectionCard
        title="Poses"
        description="Full-width editor for adding/removing poses and managing the pose map."
      >
        <div className="min-h-[560px]">
         <LevelPosesEditor
          poses={safeLevel.poses || {}}
          disabled={savingLevel}
          onPosesUpdate={(poses) => setLevel((prev) => ({ ...prev, poses }))}
          onRemovePose={removePose}
          poseTolerancePctById={safeLevel.poseTolerancePctById || {}}
          onPoseToleranceUpdate={(map) => setLevel((prev) => ({ ...prev, poseTolerancePctById: map }))}
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
                    const localPin = level?.pin ?? "";
                    setPinValue(localPin || sessionPin2 || "");
                    setEditingPin(false);
                  }}
                  disabled={savingLevel}
                  className="bg-gray-200 text-gray-900 px-3 py-2 rounded hover:bg-gray-300 disabled:opacity-50"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                {pinValue ? (
                  <span className="font-mono text-sm bg-gray-100 border px-3 py-2 rounded text-black">
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
                    const localPin = level?.pin ?? "";
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

        {/* SIDEBAR */}
        <div className="space-y-4">
          <SectionCard
            title="Settings"
            description="Stored on the level (level.settings). Defaults are applied automatically."
          >
            <div className="space-y-4">
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
                        logFPS: clampNumber(e.target.value, 1, 120, safeSettings.logFPS),
                      })
                    }
                    className={numberClass}
                  />
                </div>
              </div>

              <div className="h-px bg-gray-100" />

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
                          poseMatch: clampNumber(e.target.value, 1, 20, safeSettings.reps.poseMatch),
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
                          tween: clampNumber(e.target.value, 1, 20, safeSettings.reps.tween),
                        },
                      })
                    }
                    className={numberClass}
                  />
                </div>
              </div>

              <div className="h-px bg-gray-100" />

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
                            safeSettings.ui.dialogueFontSize
                          ),
                        },
                      })
                    }
                    className={numberClass}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={savingLevel}
                  onClick={resetSettings}
                  className="w-full border rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Reset settings to defaults
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Actions">
            <div className="space-y-3">
              <button type="button" disabled={savingLevel} onClick={onClickSaveDraft} className={primaryBtn}>
                {savingLevel ? "Saving..." : "Save Draft"}
              </button>

              <button type="button" disabled={savingLevel} onClick={onClickPublish} className={greenBtn}>
                {savingLevel ? "Publishing..." : "Publish"}
              </button>

              <button type="button" disabled={savingLevel} onClick={onClickDelete} className={dangerBtn}>
                Delete
              </button>

              <div className="text-sm text-gray-600">
                Status: {safeLevel.isPublished ? "✅ Published" : "📝 Draft"}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

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