"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useGameEditor } from "@/lib/hooks/useGameEditor";

import EditorHeader from "@/components/editor/EditorHeader";
import SectionCard from "@/components/editor/SectionCard";
import GameBasicsForm from "@/components/game/GameBasicsForm";
import GameLevelsPicker from "@/components/game/GameLevelsPicker";

export default function NewGamePage() {
  const router = useRouter();
  const { user } = useAuth();

  const isNew = true;
  const id = null;

  const {
    game,
    setGame,
    loadingGame,
    savingGame,
    allAvailableLevels,
    addLevel,
    removeLevel,
    handleSave,
  } = useGameEditor(id, isNew, user?.email);

  const safeGame = useMemo(() => game ?? {}, [game]);

  const errors = useMemo(() => {
    const e = {};
    if (!safeGame?.name || !safeGame.name.trim()) e.name = "Name is required";
    return e;
  }, [safeGame]);

  if (loadingGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading game...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <p className="text-center text-gray-900 font-semibold py-12 text-xl">
        Game not found.
      </p>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <EditorHeader
        title="Create Game"
        subtitle={user?.email ? `Author: ${user.email}` : undefined}
        onBack={() => router.back()}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Basics">
            <GameBasicsForm
              game={safeGame}
              disabled={savingGame}
              errors={errors}
              onChange={(patch) => setGame((prev) => ({ ...prev, ...patch }))}
            />
          </SectionCard>

          <SectionCard
            title="Levels"
            description="Add levels to include in this game. You can reorder in the editor after creating the game."
          >
            <GameLevelsPicker
              levelIds={safeGame.levelIds || []}
              availableLevels={allAvailableLevels || {}}
              onAdd={(levelId) => addLevel(levelId)}
              onRemove={(index) => removeLevel(index)}
              disabled={savingGame}
            />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Actions">
            <div className="space-y-3">
              <button
                type="button"
                disabled={savingGame || Boolean(errors.name)}
                onClick={() => handleSave(false)}
                className="w-full bg-gray-900 text-white px-4 py-2 rounded hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingGame ? "Saving..." : "Save Draft"}
              </button>

              <button
                type="button"
                disabled={savingGame || Boolean(errors.name)}
                onClick={() => handleSave(true)}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingGame ? "Publishing..." : "Publish"}
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="w-full border px-4 py-2 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
