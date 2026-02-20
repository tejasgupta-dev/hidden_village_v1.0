"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useGameEditor } from "@/lib/hooks/useGameEditor";

import EditorHeader from "@/components/editor/EditorHeader";
import SectionCard from "@/components/editor/SectionCard";
import GameBasicsForm from "@/components/game/GameBasicsForm";
import GameLevelsPicker from "@/components/game/GameLevelsPicker";
import StorylineEditor from "@/components/storylineEditor";

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

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
    getStoredPin,
  } = useGameEditor(id, isNew, user?.email);

  const [showStorylineEditor, setShowStorylineEditor] = useState(false);

  const safeGame = useMemo(() => game ?? {}, [game]);

  const patchGame = (patch) => {
    setGame((prev) => ({ ...(prev ?? {}), ...(patch ?? {}) }));
  };

  // Make availableLevels shape match GameLevelsPicker: Record<string, {id,name,description}>
  const availableLevelsMap = useMemo(() => {
    const src = allAvailableLevels || {};
    const next = {};
    for (const [lvlId, lvl] of Object.entries(src)) {
      next[lvlId] = {
        id: lvlId,
        name: lvl?.name || "Untitled Level",
        description: lvl?.description || "",
      };
    }
    return next;
  }, [allAvailableLevels]);

  const levelIds = useMemo(() => asArray(safeGame.levelIds), [safeGame.levelIds]);

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

  // For "new", some hooks briefly return null before init — don’t show "not found"
  if (!game) return null;

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
              getStoredPin={getStoredPin}
              onChange={(patch) => patchGame(patch)}
            />
          </SectionCard>

          <SectionCard
            title="Levels"
            description="Add levels to include in this game. You can reorder in the editor after creating the game."
          >
            {/* Levels header actions (Storyline like GameEditor) */}
            <div className="flex items-center justify-end mb-3">
              <button
                type="button"
                onClick={() => setShowStorylineEditor(true)}
                disabled={savingGame || levelIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-sm rounded hover:bg-gray-300 text-gray-900 disabled:opacity-50"
              >
                <BookOpen size={16} />
                Storyline
              </button>
            </div>

            <GameLevelsPicker
              levelIds={levelIds}
              availableLevels={availableLevelsMap}
              onAdd={(levelId) => addLevel(levelId)}
              onRemove={(index) => removeLevel(index)}
              disabled={savingGame}
            />

            <p className="text-xs text-gray-500 mt-3">
              Storyline is stored per level index (intro/outro) under{" "}
              <span className="font-mono">game.storyline</span>.
            </p>
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
                className="w-full border px-4 py-2 rounded hover:bg-gray-50 text-gray-900"
              >
                Cancel
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      {showStorylineEditor && (
        <StorylineEditor
          game={safeGame}
          setGame={setGame}
          onClose={() => setShowStorylineEditor(false)}
        />
      )}
    </div>
  );
}
