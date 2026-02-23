"use client";

import React from "react";

/**
 * Edit options and correct answers.
 * Assumes answers are an array of option indices.
 */
export default function LevelOptionsEditor({
  options = [],
  answers = [],
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onToggleAnswer,
  disabled = false,
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Options</h3>
        <button
          type="button"
          onClick={() => onAddOption?.()}
          disabled={disabled}
          className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          + Add Option
        </button>
      </div>

      {options.length === 0 ? (
        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
          No options yet.
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((opt, idx) => {
            const isCorrect = Array.isArray(answers) && answers.includes(idx);
            return (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isCorrect}
                    onChange={() => onToggleAnswer?.(idx)}
                    disabled={disabled}
                    className="h-4 w-4"
                    title="Mark as correct"
                  />
                  <span className="text-xs text-gray-500">Correct</span>
                </div>

                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={opt || ""}
                  onChange={(e) => onUpdateOption?.(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  disabled={disabled}
                />

                <button
                  type="button"
                  onClick={() => onRemoveOption?.(idx)}
                  disabled={disabled}
                  className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50 self-end sm:self-auto"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-sm text-gray-500">Tip: You can mark multiple correct answers.</p>
    </div>
  );
}
