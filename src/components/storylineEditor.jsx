"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { DEFAULT_SPEAKERS } from "@/lib/assets/defaultSprites";

const SECTIONS = ["intro", "outro"];

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export default function StorylineEditor({ game, setGame, onClose }) {
  const [levelIndex, setLevelIndex] = useState(0);

  const levelIds = game?.levelIds ?? [];

  // keep index in bounds if levels change
  const safeLevelIndex = useMemo(() => {
    if (!levelIds.length) return 0;
    return Math.max(0, Math.min(levelIndex, levelIds.length - 1));
  }, [levelIds.length, levelIndex]);

  const levelStory = (game?.storyline ?? [])[safeLevelIndex] ?? {
    intro: [],
    outro: [],
  };

  // Custom speakers stored on the game (uploaded/created)
  // Supports BOTH:
  //  - settings.speakers: { [id]: {id,name,url,path,...} }
  //  - settings.speakerById + settings.speakerUrlById (if you switch later)
  const customSpeakersMap = useMemo(() => {
    const s = game?.settings ?? {};
    if (isPlainObject(s.speakers)) return s.speakers;

    // Optional alt shape support
    if (isPlainObject(s.speakerById)) {
      const urlById = isPlainObject(s.speakerUrlById) ? s.speakerUrlById : {};
      const out = {};
      for (const [id, meta] of Object.entries(s.speakerById)) {
        const safeId = String(id || "").trim();
        if (!safeId) continue;
        out[safeId] = {
          id: safeId,
          name: meta?.name ?? safeId,
          url: urlById?.[safeId] ?? meta?.url ?? null,
        };
      }
      return out;
    }

    return {};
  }, [game?.settings]);

  // Merge defaults + custom (custom wins on id collision)
  const mergedSpeakersMap = useMemo(() => {
    const out = {};
    for (const s of DEFAULT_SPEAKERS || []) {
      const id = String(s?.id ?? "").trim();
      const name = String(s?.name ?? "").trim();
      const url = s?.url ?? null;
      if (!id || !name) continue;
      out[id] = { id, name, url, _isDefault: true };
    }

    for (const [id, s] of Object.entries(customSpeakersMap || {})) {
      const sid = String(s?.id ?? id ?? "").trim();
      const name = String(s?.name ?? "").trim();
      if (!sid || !name) continue;
      out[sid] = {
        id: sid,
        name,
        url: s?.url ?? null,
        path: s?.path ?? null,
        createdAt: s?.createdAt ?? null,
        _isDefault: false,
      };
    }

    return out;
  }, [customSpeakersMap]);

  const speakerOptions = useMemo(() => {
    return Object.values(mergedSpeakersMap)
      .map((s) => ({
        id: String(s.id),
        name: String(s.name),
        url: s.url ?? null,
        isDefault: !!s._isDefault,
      }))
      .filter((s) => s.id && s.name)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [mergedSpeakersMap]);

  const inputClass =
    "border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 " +
    "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 " +
    "!text-gray-900";

  /* -------------------------------------------------------
     HELPERS
  ------------------------------------------------------- */

  function ensureLevel(index) {
    const newGame = {
      ...game,
      storyline: (game?.storyline ?? []).map((l) =>
        l
          ? {
              intro: [...(l.intro ?? [])],
              outro: [...(l.outro ?? [])],
            }
          : { intro: [], outro: [] }
      ),
    };

    while (newGame.storyline.length <= index) {
      newGame.storyline.push({ intro: [], outro: [] });
    }

    return newGame;
  }

  /* -------------------------------------------------------
     DIALOGUE CRUD
  ------------------------------------------------------- */

  function addDialogue(section) {
    const newGame = ensureLevel(safeLevelIndex);
    newGame.storyline[safeLevelIndex][section] = [
      ...(newGame.storyline[safeLevelIndex][section] ?? []),
      { speakerId: "", text: "" },
    ];
    setGame(newGame);
  }

  function updateDialogue(section, i, field, value) {
    const newGame = ensureLevel(safeLevelIndex);
    const entries = [...(newGame.storyline[safeLevelIndex][section] ?? [])];
    entries[i] = { ...entries[i], [field]: value };
    newGame.storyline[safeLevelIndex][section] = entries;
    setGame(newGame);
  }

  function removeDialogue(section, i) {
    const newGame = ensureLevel(safeLevelIndex);
    const entries = [...(newGame.storyline[safeLevelIndex][section] ?? [])];
    entries.splice(i, 1);
    newGame.storyline[safeLevelIndex][section] = entries;
    setGame(newGame);
  }

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Storyline Editor</h2>
            {levelIds.length > 0 ? (
              <p className="text-xs text-gray-600 mt-0.5">
                Editing level {safeLevelIndex + 1} of {levelIds.length}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scroll area */}
        <div className="max-h-[80vh] overflow-auto px-6 py-5">
          {/* NO LEVELS */}
          {levelIds.length === 0 ? (
            <div className="text-center py-14">
              <div className="text-gray-900 font-semibold mb-2">No levels yet</div>
              <p className="text-sm text-gray-600">
                Add levels from the game editor first, then come back here to edit dialogue.
              </p>
            </div>
          ) : (
            <>
              {/* LEVEL TABS */}
              <div className="flex flex-wrap gap-2 mb-6">
                {levelIds.map((id, i) => {
                  const active = i === safeLevelIndex;
                  return (
                    <button
                      key={`${id}-${i}`}
                      type="button"
                      onClick={() => setLevelIndex(i)}
                      className={[
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                        active
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
                      ].join(" ")}
                      title={id}
                    >
                      <span>Level {i + 1}</span>
                      <span
                        className={[
                          "ml-2 text-xs",
                          active ? "opacity-80" : "text-gray-500",
                        ].join(" ")}
                      >
                        {String(id).length > 14
                          ? `${String(id).slice(0, 6)}…${String(id).slice(-6)}`
                          : `(${id})`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* SECTIONS */}
              <div className="grid grid-cols-1 gap-6">
                {SECTIONS.map((section) => {
                  const entries = levelStory?.[section] ?? [];
                  return (
                    <div key={section} className="border rounded-2xl p-4 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold capitalize text-gray-900">{section}</h3>

                        <button
                          type="button"
                          onClick={() => addDialogue(section)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-900"
                        >
                          <Plus size={14} />
                          Add line
                        </button>
                      </div>

                      {entries.length === 0 ? (
                        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4">
                          No lines yet. Click <span className="font-medium">Add line</span> to start.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {entries.map((dialogue, i) => {
                            // Back-compat: older lines might have speaker: {id} or speaker string.
                            const valueForSelect =
                              dialogue?.speakerId ??
                              (typeof dialogue?.speaker === "object" && dialogue?.speaker?.id
                                ? dialogue.speaker.id
                                : "");

                            return (
                              <div
                                key={`${section}-${i}`}
                                className="flex flex-col md:flex-row gap-2 md:items-center"
                              >
                                {/* Speaker dropdown */}
                                <select
                                  value={valueForSelect}
                                  onChange={(e) =>
                                    updateDialogue(section, i, "speakerId", e.target.value)
                                  }
                                  className={`${inputClass} md:w-56`}
                                >
                                  <option value="">Select speaker…</option>

                                  {/* Defaults first */}
                                  <optgroup label="Default">
                                    {speakerOptions
                                      .filter((s) => s.isDefault)
                                      .map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                        </option>
                                      ))}
                                  </optgroup>

                                  {/* Custom second */}
                                  <optgroup label="Custom">
                                    {speakerOptions
                                      .filter((s) => !s.isDefault)
                                      .map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                        </option>
                                      ))}
                                  </optgroup>
                                </select>

                                <input
                                  placeholder="Dialogue"
                                  value={dialogue?.text ?? ""}
                                  onChange={(e) =>
                                    updateDialogue(section, i, "text", e.target.value)
                                  }
                                  className={`${inputClass} flex-1`}
                                />

                                <button
                                  type="button"
                                  onClick={() => removeDialogue(section, i)}
                                  className="p-2 rounded-lg hover:bg-red-50 text-red-600 self-start md:self-auto"
                                  title="Remove line"
                                  aria-label="Remove line"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {speakerOptions.length === 0 ? (
                        <div className="mt-3 text-xs text-gray-500">
                          No speakers available.
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}