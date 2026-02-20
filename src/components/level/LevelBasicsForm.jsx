"use client";

import React from "react";
import FormField from "@/components/editor/FormField";

/**
 * Pure UI for core level fields (does not include PIN/publish controls).
 */
export default function LevelBasicsForm({ level, onChange, disabled = false, errors = {} }) {
  const l = level || {};

  return (
    <div className="space-y-4">
      <FormField
        id="level-name"
        label="Level Name"
        placeholder="Enter level name"
        value={l.name || ""}
        onChange={(e) => onChange?.({ name: e.target.value })}
        disabled={disabled}
        error={errors.name}
      />

      <FormField
        id="level-keywords"
        label="Keywords"
        placeholder="e.g. balance, pose, beginner"
        value={l.keywords || ""}
        onChange={(e) => onChange?.({ keywords: e.target.value })}
        disabled={disabled}
        helper="Used for search and filtering."
      />

      <FormField
        id="level-description"
        label="Description"
        variant="textarea"
        placeholder="Describe the level"
        value={l.description || ""}
        onChange={(e) => onChange?.({ description: e.target.value })}
        disabled={disabled}
      />

      <FormField
        id="level-question"
        label="Question"
        placeholder="What should the player answer?"
        value={l.question || ""}
        onChange={(e) => onChange?.({ question: e.target.value })}
        disabled={disabled}
      />
    </div>
  );
}
