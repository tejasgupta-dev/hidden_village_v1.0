"use client";

import React, { useMemo, useState } from "react";
import FormField from "@/components/editor/FormField";

/**
 * Pure UI component for selecting and listing levels inside a game.
 *
 * Props:
 * - levelIds: string[]
 * - availableLevels: Record<string, { id, name, description }>
 * - onAdd: (levelId: string) => void
 * - onRemove: (index: number) => void
 * - disabled: boolean
 */
export default function GameLevelsPicker({
  levelIds = [],
  availableLevels = {},
  onAdd,
  onRemove,
  disabled = false,
}) {
  const [selectedLevel, setSelectedLevel] = useState("");
  const [search, setSearch] = useState("");

  const options = useMemo(() => {
    const entries = Object.entries(availableLevels || {});
    const q = (search || "").trim().toLowerCase();

    const filtered = q
      ? entries.filter(([_, lvl]) => {
          const name = (lvl?.name || "").toLowerCase();
          const desc = (lvl?.description || "").toLowerCase();
          return name.includes(q) || desc.includes(q);
        })
      : entries;

    return filtered
      .map(([id, lvl]) => ({
        id,
        name: lvl?.name || "Untitled Level",
        description: lvl?.description || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availableLevels, search]);

  const canAdd = Boolean(selectedLevel) && !disabled;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FormField
          id="level-search"
          label="Search levels"
          placeholder="Type to filter"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
        />

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Add level
          </label>
          <div className="flex gap-2">
            <select
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-gray-900"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              disabled={disabled}
            >
              <option value="">Select a level...</option>
              {options.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!selectedLevel) return;
                onAdd?.(selectedLevel);
                setSelectedLevel("");
              }}
              disabled={!canAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Selected levels</h3>

        {levelIds.length === 0 ? (
          <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
            No levels selected yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {levelIds.map((levelId, index) => {
              const lvl = availableLevels?.[levelId] || {};
              return (
                <li
                  key={`${levelId}-${index}`}
                  className="flex items-start justify-between gap-3 p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {lvl.name || `Level ${index + 1}`}
                    </p>
                    {lvl.description && (
                      <p className="text-sm text-gray-600 mt-1">{lvl.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">ID: {levelId}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove?.(index)}
                    disabled={disabled}
                    className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
