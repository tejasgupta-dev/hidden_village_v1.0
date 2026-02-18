"use client";

import React from "react";

/**
 * Simple reusable card wrapper for editor pages.
 */
export default function SectionCard({ title, description, children, className = "" }) {
  return (
    <div className={`bg-white rounded-lg shadow border border-gray-100 ${className}`.trim()}>
      {(title || description) && (
        <div className="px-6 py-4 border-b border-gray-100">
          {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}
