"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import gamesApi from "@/lib/api/games.api";
import GamePlayer from "@/lib/gamePlayer/gamePlayer";

function normalizePosesToMatch(poses) {
  if (!poses) return [];

  // If already an array, try to parse entries
  if (Array.isArray(poses)) {
    return poses
      .map((v) => {
        if (v == null) return null;
        if (typeof v === "string") {
          try {
            return JSON.parse(v);
          } catch {
            return null;
          }
        }
        return v;
      })
      .filter(Boolean);
  }

  if (typeof poses !== "object") return [];

  // Stable order by key
  const keys = Object.keys(poses).sort();
  return keys
    .map((k) => poses[k])
    .map((v) => {
      if (v == null) return null;
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      }
      return v;
    })
    .filter(Boolean);
}

export default function PlayGamePage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const gameId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gameData, setGameData] = useState(null);

  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!gameId) return;
      setLoading(true);
      setError("");

      try {
        // IMPORTANT: gamesApi.get expects query params inside { params: {...} }
        const gameRes = await gamesApi.get(gameId, { params: { mode: "play" } });
        if (!gameRes?.success || !gameRes?.game) {
          throw new Error(gameRes?.message || "Failed to load game");
        }

        const levelsRes = await gamesApi.getLevels(gameId);
        if (!levelsRes?.success || !Array.isArray(levelsRes?.levels)) {
          throw new Error(levelsRes?.message || "Failed to load levels");
        }

        // Shape data to what GamePlayer expects.
        const levels = levelsRes.levels.map((lvl) => ({
          ...lvl,
          dialogues: lvl.dialogues || { intro: [], outro: [] },
          tween: lvl.tween || null,
          insights: lvl.insights || [],
          posesToMatch: lvl.posesToMatch || normalizePosesToMatch(lvl.poses),
        }));

        const data = {
          ...gameRes.game,
          levels,
        };

        if (mounted) setGameData(data);
      } catch (e) {
        console.error(e);
        if (mounted) setError(e?.message || "Failed to load game");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [gameId]);

  const title = useMemo(() => gameData?.name || "Game", [gameData]);

  // Force recordings off until play logging endpoints are solid
  const playerSettings = useMemo(() => {
    const base = gameData?.settings || {};
    return {
      fps: typeof base.fps === "number" ? base.fps : 12,
      skipStates: Array.isArray(base.skipStates) ? base.skipStates : [],
      poseRecording: false,
      mediaRecording: false,
      eventRecording: false,
    };
  }, [gameData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-900 text-sm">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-center text-xl text-red-600">⚠️ {error}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="border px-4 py-2 rounded hover:bg-gray-50"
        >
          Back
        </button>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-center text-xl text-gray-700">Game not found.</p>
      </div>
    );
  }

  const levelCount = Array.isArray(gameData.levels) ? gameData.levels.length : 0;

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow p-6">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>

          {gameData.description ? (
            <p className="text-gray-600 mt-2">{gameData.description}</p>
          ) : null}

          <p className="text-gray-500 mt-4 text-sm">Levels: {levelCount}</p>

          {levelCount === 0 ? (
            <p className="mt-3 text-sm text-red-600">
              This game has no levels yet.
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setCompleted(false);
                setStarted(true);
              }}
              disabled={levelCount === 0}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Start
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full border px-4 py-2 rounded hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow p-6">
          <h1 className="text-3xl font-bold text-gray-900">✅ Completed!</h1>
          <p className="text-gray-600 mt-2">You finished: {title}</p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setCompleted(false);
                setStarted(false);
              }}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Play Again
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full border px-4 py-2 rounded hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GamePlayer
      gameData={gameData}
      settings={playerSettings}
      sessionId={null}
      onComplete={() => setCompleted(true)}
    />
  );
}
