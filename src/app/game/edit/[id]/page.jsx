"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, MoveDown, MoveUp, Trash2 } from "lucide-react";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useGameEditor } from "@/lib/hooks/useGameEditor";

import StorylineEditor from "@/components/storylineEditor";
import GameBasicsForm from "@/components/game/GameBasicsForm";
import GameLevelsPicker from "@/components/game/GameLevelsPicker";

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeId(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const MAX_SPEAKER_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export default function GameEditor() {
  const pathname = usePathname();
  const router = useRouter();
  const id = pathname.split("/").filter(Boolean).pop();
  const { user } = useAuth();

  const {
    game,
    setGame,
    loadingGame,
    savingGame,
    allAvailableLevels,
    addLevel,
    removeLevel,
    getLevelData,
    handleSave,
    handleDelete,
    getStoredPin,
    uploadAsset, // ✅ from hook
  } = useGameEditor(id, false, user?.email);

  // UI state
  const [showStorylineEditor, setShowStorylineEditor] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState(null);

  // Speaker uploader UI
  const [speakerName, setSpeakerName] = useState("");
  const [speakerFile, setSpeakerFile] = useState(null);
  const [uploadingSpeaker, setUploadingSpeaker] = useState(false);

  const handleBack = () => router.push("/");

  const patchGame = (patch) => {
    setGame((prev) => ({ ...(prev ?? {}), ...(patch ?? {}) }));
  };

  const patchSettings = (patch) => {
    setGame((prev) => ({
      ...(prev ?? {}),
      settings: {
        ...((prev ?? {}).settings ?? {}),
        ...(patch ?? {}),
      },
    }));
  };

  const speakersMap = useMemo(() => {
    return (game?.settings?.speakers && typeof game.settings.speakers === "object")
      ? game.settings.speakers
      : {};
  }, [game?.settings?.speakers]);

  const speakersList = useMemo(() => {
    return Object.values(speakersMap).sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""))
    );
  }, [speakersMap]);

  const removeSpeaker = (speakerId) => {
    setGame((prev) => {
      const prevSpeakers = prev?.settings?.speakers || {};
      const nextSpeakers = { ...prevSpeakers };
      delete nextSpeakers[speakerId];

      // Optional: you could also scrub storyline references here if you want.
      return {
        ...(prev ?? {}),
        settings: {
          ...(prev?.settings ?? {}),
          speakers: nextSpeakers,
        },
      };
    });
  };

  const handleUploadSpeaker = async () => {
    if (!game?.id) {
      alert("Save the game first before uploading speaker images.");
      return;
    }

    const name = speakerName.trim();
    const idSlug = safeId(name);

    if (!name) {
      alert("Enter a speaker name.");
      return;
    }
    if (!idSlug) {
      alert("Speaker name is invalid.");
      return;
    }
    if (!speakerFile) {
      alert("Choose an image file.");
      return;
    }

    if (speakersMap[idSlug]) {
      alert("That speaker name already exists in this game. Choose a different name.");
      return;
    }

    if (speakerFile.size > MAX_SPEAKER_IMAGE_BYTES) {
      alert("Image too large. Max size is 5MB.");
      return;
    }

    if (speakerFile.type && !ALLOWED_IMAGE_TYPES.has(speakerFile.type)) {
      alert("Unsupported image type. Use png/jpg/webp/gif.");
      return;
    }

    setUploadingSpeaker(true);
    try {
      // Upload to game storage
      const res = await uploadAsset(speakerFile, { kind: "speakers" });
      if (!res?.success || !res?.path) throw new Error("Upload failed");

      // Store inside game.settings.speakers
      const createdAt = Date.now();
      patchSettings({
        speakers: {
          ...(game?.settings?.speakers ?? {}),
          [idSlug]: {
            id: idSlug,
            name,
            path: res.path, // ✅ stable storage path
            createdAt,
          },
        },
      });

      // clear inputs
      setSpeakerName("");
      setSpeakerFile(null);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to upload speaker image");
    } finally {
      setUploadingSpeaker(false);
    }
  };

  /* ------------------ SAFE MEMO VALUES (ABOVE EARLY RETURNS) ------------------ */
  const levelIds = useMemo(() => asArray(game?.levelIds), [game?.levelIds]);

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

  const toggleExpandLevel = (levelId) => {
    setExpandedLevel((prev) => (prev === levelId ? null : levelId));
  };

  const moveLevel = (index, direction) => {
    const newIndex = index + direction;
    if (!game) return;
    if (newIndex < 0 || newIndex >= (game.levelIds ?? []).length) return;

    setGame((prev) => {
      const newLevelIds = [...(prev.levelIds || [])];
      const newStoryline = [...(prev.storyline || [])];

      [newLevelIds[index], newLevelIds[newIndex]] = [
        newLevelIds[newIndex],
        newLevelIds[index],
      ];
      [newStoryline[index], newStoryline[newIndex]] = [
        newStoryline[newIndex],
        newStoryline[index],
      ];

      return { ...prev, levelIds: newLevelIds, storyline: newStoryline };
    });
  };

  /* ------------------ EARLY RETURNS ------------------ */
  if (loadingGame) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Game not found.
      </div>
    );
  }

  /* ------------------ RENDER ------------------ */
  return (
    <div className="min-h-screen py-6 px-4 max-w-5xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={18} /> Back
        </button>

        <h1 className="text-xl font-bold text-gray-900">Edit Game</h1>
        <div />
      </div>

      {/* GAME INFO */}
      <div className="bg-white p-5 rounded border space-y-4">
        <GameBasicsForm
          game={game}
          disabled={savingGame}
          errors={{}}
          getStoredPin={getStoredPin}
          onChange={(patch) => patchGame(patch)}
        />
      </div>

      {/* SPEAKER IMAGES */}
      <div className="bg-white p-5 rounded border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Speaker Images</h2>
          <div className="text-xs text-gray-500">Max 5MB • Unique names</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
            placeholder="Speaker name (e.g., Guide)"
            className="border rounded px-3 py-2"
            disabled={savingGame || uploadingSpeaker}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSpeakerFile(e.target.files?.[0] || null)}
            className="border rounded px-3 py-2"
            disabled={savingGame || uploadingSpeaker}
          />
          <button
            type="button"
            onClick={handleUploadSpeaker}
            disabled={savingGame || uploadingSpeaker}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {uploadingSpeaker ? "Uploading..." : "Upload speaker"}
          </button>
        </div>

        {speakersList.length === 0 ? (
          <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4">
            No speaker images yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {speakersList.map((s) => (
              <div key={s.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{s.name}</div>
                  <div className="text-xs text-gray-500 truncate">{s.path}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeSpeaker(s.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                  disabled={savingGame}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LEVELS */}
      <div className="bg-white p-5 rounded border space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Levels</h2>

          <button
            type="button"
            onClick={() => setShowStorylineEditor(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-sm rounded hover:bg-gray-300 text-gray-900"
            disabled={savingGame}
          >
            <BookOpen size={16} />
            Storyline
          </button>
        </div>

        <GameLevelsPicker
          levelIds={levelIds}
          availableLevels={availableLevelsMap}
          disabled={savingGame}
          onAdd={(lvlId) => addLevel(lvlId)}
          onRemove={(index) => removeLevel(index)}
        />

        {levelIds.length > 0 && (
          <div className="pt-3 border-t space-y-2">
            <div className="text-sm font-semibold text-gray-900">Order</div>

            {levelIds.map((levelId, index) => {
              const levelData = getLevelData(levelId) || {};
              const isExpanded = expandedLevel === levelId;

              return (
                <div key={`${levelId}-${index}`} className="border rounded">
                  <div
                    className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleExpandLevel(levelId)}
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-sm text-gray-900">
                        {levelData.name || levelId}
                      </span>
                      {levelData.name && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({levelId})
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 items-center">
                      <MoveUp
                        size={18}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveLevel(index, -1);
                        }}
                        className={`cursor-pointer ${
                          index === 0
                            ? "opacity-30 pointer-events-none"
                            : "hover:text-blue-600"
                        }`}
                      />
                      <MoveDown
                        size={18}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveLevel(index, 1);
                        }}
                        className={`cursor-pointer ${
                          index === levelIds.length - 1
                            ? "opacity-30 pointer-events-none"
                            : "hover:text-blue-600"
                        }`}
                      />
                      <Trash2
                        size={18}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLevel(index);
                        }}
                        className="cursor-pointer text-red-500 hover:text-red-700"
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-3 pb-3 pt-2 bg-gray-50 text-sm text-gray-700 space-y-1">
                      {levelData.description ? (
                        <p>{levelData.description}</p>
                      ) : (
                        <p className="italic text-gray-500">No description.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 justify-center pb-8">
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={savingGame}
          className="bg-gray-800 text-white px-5 py-2 rounded hover:bg-gray-900 disabled:opacity-50"
        >
          {savingGame ? "Saving..." : "Save Draft"}
        </button>

        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={savingGame}
          className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {savingGame ? "Publishing..." : "Publish"}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={savingGame}
          className="bg-red-600 text-white px-5 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {showStorylineEditor && (
        <StorylineEditor
          game={game}
          setGame={setGame}
          onClose={() => setShowStorylineEditor(false)}
        />
      )}
    </div>
  );
}