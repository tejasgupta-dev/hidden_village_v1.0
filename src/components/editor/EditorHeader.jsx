"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";

export default function EditorHeader({ title, subtitle, onBack, rightSlot }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-1 inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 hover:bg-gray-50"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-gray-600">{subtitle}</p>}
        </div>
      </div>

      {rightSlot ? <div className="flex gap-2 self-start">{rightSlot}</div> : null}
    </div>
  );
}
