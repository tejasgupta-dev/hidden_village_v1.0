"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowSize } from "@/lib/gamePlayer/runtime/useWindowSize";
import GamePlayerInner from "./gamePlayerInner";

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

export default function GamePlayerRoot({
  game,
  levelIndex = 0,
  deviceId = "web",
  onComplete,
}) {
  const { width, height } = useWindowSize(640, 480);

  const gameId = game?.id ?? null;
  const initialLevelId = game?.levels?.[levelIndex]?.id ?? null;

  const [playId, setPlayId] = useState(null);
  const [creatingPlay, setCreatingPlay] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Prevent accidental double create in dev StrictMode
  const createdOnceRef = useRef(false);

  const createPlay = useCallback(async () => {
    if (!gameId || !initialLevelId) return;

    setCreatingPlay(true);
    setCreateError(null);

    const maxAttempts = 6;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await fetch("/api/plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ gameId, levelId: initialLevelId, deviceId }),
        });

        if (res.ok) {
          const json = await res.json();
          setPlayId(json.playId);
          setCreatingPlay(false);
          return;
        }

        const text = await res.text().catch(() => "");
        const msg = `Failed to create play (${res.status}): ${text}`;

        // Retry auth transient failures
        if ((res.status === 401 || res.status === 403) && attempt < maxAttempts) {
          await sleep(250 * attempt);
          continue;
        }

        throw new Error(msg);
      }
    } catch (e) {
      setCreateError(e?.message ?? String(e));
      setCreatingPlay(false);
    }
  }, [gameId, initialLevelId, deviceId]);

  // Create play on mount (once), only after initialLevelId exists
  useEffect(() => {
    if (!gameId || !initialLevelId) return;
    if (playId) return;

    if (createdOnceRef.current) return;
    createdOnceRef.current = true;

    void createPlay();
  }, [gameId, initialLevelId, playId, createPlay]);

  if (!gameId || !initialLevelId) {
    return (
      <div className="w-full h-screen bg-gray-950 text-white flex items-center justify-center">
        Preparing game…
      </div>
    );
  }

  if (!playId) {
    return (
      <div className="w-full h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-lg">{creatingPlay ? "Creating play…" : "Preparing…"}</div>

        {createError ? (
          <div className="max-w-xl text-sm text-red-200 bg-red-900/30 ring-1 ring-red-500/30 rounded-xl p-3">
            {createError}
          </div>
        ) : (
          <div className="text-sm text-white/60">Waiting for session + creating play…</div>
        )}

        <button
          type="button"
          onClick={() => {
            // allow retry even if strict-mode already ran
            createdOnceRef.current = false;
            void createPlay();
          }}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 ring-1 ring-white/20"
          disabled={creatingPlay}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <GamePlayerInner
      game={game}
      levelIndex={levelIndex}
      deviceId={deviceId}
      playId={playId}
      onComplete={onComplete}
      width={width}
      height={height}
    />
  );
}