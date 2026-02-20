"use client";

import React from "react";
import FormField from "@/components/editor/FormField";

/**
 * Pure UI for core game fields.
 */
export default function GameBasicsForm({ game, onChange, disabled = false, errors = {} }) {
  const g = game || {};

  return (
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

      <FormField
        id="game-pin"
        label="PIN"
        type="password"
        placeholder="Optional"
        value={g.pin || ""}
        onChange={(e) => onChange?.({ pin: e.target.value })}
        disabled={disabled}
        helper="If set, editing requires this PIN for non-owners/admins."
      />
    </div>
  );
}
