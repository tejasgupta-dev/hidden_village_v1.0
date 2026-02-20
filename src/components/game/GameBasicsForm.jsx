"use client";

import React, { useEffect, useRef, useState } from "react";
import FormField from "@/components/editor/FormField";
import { Check, X } from "lucide-react";

/**
 * Pure UI for core game fields + PIN controls (level-editor style).
 *
 * Props:
 * - game: object
 * - onChange: (patch) => void
 * - disabled?: boolean
 * - errors?: Record<string,string>
 * - getStoredPin?: () => string
 */
export default function GameBasicsForm({
  game,
  onChange,
  disabled = false,
  errors = {},
  getStoredPin,
}) {
  const g = game || {};

  // PIN UI state
  const [editingPin, setEditingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const pinRef = useRef(null);

  // suppress sessionStorage PIN being re-displayed after local remove
  const [ignoreStoredPin, setIgnoreStoredPin] = useState(false);

  /* ------------------ PIN SYNC (don’t overwrite while typing) ------------------ */
  useEffect(() => {
    if (editingPin) return;

    if (ignoreStoredPin) {
      setPinValue((g.pin ?? "") || "");
      return;
    }

    const sessionPin = getStoredPin?.() || "";
    const localPin = g.pin ?? "";
    setPinValue(localPin || sessionPin || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.pin, editingPin, ignoreStoredPin]);

  // if the game loads with a real pin, allow normal hydration again
  useEffect(() => {
    if (((g.pin ?? "") || "").trim()) setIgnoreStoredPin(false);
  }, [g.pin]);

  const storedPin = !ignoreStoredPin ? (getStoredPin?.() || "") : "";
  const hasPin =
    Boolean(((g.pin ?? "") || "").trim()) ||
    Boolean(g?.hasPin) ||
    Boolean((storedPin || "").trim());

  const applyDraftPin = (nextPin) => {
    onChange?.({ pin: nextPin }); // draft only; save happens in parent
    if ((nextPin || "").trim()) setIgnoreStoredPin(false);
    else setIgnoreStoredPin(true);
  };

  const handleRemovePin = () => {
    applyDraftPin("");
    setPinValue("");
    setEditingPin(false);
    setIgnoreStoredPin(true);
  };

  return (
    <div className="space-y-6">
      {/* CORE FIELDS */}
      <div className="space-y-4">
        <FormField
          id="game-name"
          label="Game Name"
          placeholder="Enter game name"
          value={g.name || ""}
          onChange={(e) => onChange?.({ name: e.target.value })}
          disabled={disabled}
          error={errors.name}
        />

        <FormField
          id="game-keywords"
          label="Keywords"
          placeholder="e.g. ninja, stealth, motion"
          value={g.keywords || ""}
          onChange={(e) => onChange?.({ keywords: e.target.value })}
          disabled={disabled}
          helper="Used for search and discovery."
        />

        <FormField
          id="game-description"
          label="Description"
          variant="textarea"
          placeholder="Describe the game"
          value={g.description || ""}
          onChange={(e) => onChange?.({ description: e.target.value })}
          disabled={disabled}
        />
      </div>

      {/* PIN (level-editor style UI) */}
      <div className="pt-4 border-t space-y-2">
        <label className="block text-sm font-medium text-gray-900">
          PIN Protection
        </label>

        {editingPin ? (
          <div className="flex gap-2">
            <input
              ref={pinRef}
              type="text"
              value={pinValue ?? ""}
              onChange={(e) => setPinValue(e.target.value)}
              placeholder="Enter PIN (min 4 characters)"
              disabled={disabled}
              className={[
                "border border-gray-300 rounded-lg px-3 py-2 flex-1 font-mono",
                "bg-white text-gray-900 placeholder:text-gray-400",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                disabled ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "",
                "!text-gray-900",
              ].join(" ")}
            />

            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                applyDraftPin(pinValue);
                setEditingPin(false);
              }}
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              title="Apply (draft)"
            >
              <Check size={16} />
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                const sessionPin2 = !ignoreStoredPin ? getStoredPin?.() || "" : "";
                const localPin = g.pin ?? "";
                setPinValue(localPin || sessionPin2 || "");
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
            {pinValue ? (
              <span className="font-mono text-sm bg-gray-50 border px-3 py-2 rounded text-gray-900">
                {pinValue}
              </span>
            ) : hasPin ? (
              <span className="text-sm text-gray-500 italic px-3 py-2">
                PIN set (not returned by server)
              </span>
            ) : (
              <span className="text-sm text-gray-500 px-3 py-2">No PIN set</span>
            )}

            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setIgnoreStoredPin(false);
                const sessionPin2 = getStoredPin?.() || "";
                const localPin = g.pin ?? "";
                setPinValue(localPin || sessionPin2 || "");
                setEditingPin(true);
                setTimeout(() => pinRef.current?.focus(), 0);
              }}
              className="border px-3 py-2 rounded hover:bg-gray-50 text-gray-900 disabled:opacity-50"
            >
              {hasPin ? "🔒 Change PIN" : "🔓 Set PIN"}
            </button>

            {hasPin && (
              <button
                type="button"
                disabled={disabled}
                onClick={handleRemovePin}
                className="text-red-600 hover:text-red-700 px-3 py-2 disabled:opacity-50"
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
    </div>
  );
}
