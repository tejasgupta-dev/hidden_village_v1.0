"use client";

import { useRef } from "react";

export function useGameSession({ gameId, levelId }) {

  const playId = useRef(null);

  async function createSession(deviceId = "web") {

    const res = await fetch("/api/plays", {
      method: "POST",
      body: JSON.stringify({
        gameId,
        levelId,
        deviceId
      })
    });

    const json = await res.json();

    playId.current = json.playId;

    return json.playId;
  }

  async function storeEvent(type, payload = {}) {

    if (!playId.current) return;

    await fetch(`/api/plays/${playId.current}/events`, {
      method: "POST",
      body: JSON.stringify({
        type,
        timestamp: Date.now(),
        payload
      })
    });

  }

  async function storeFrameBatch(frames) {

    if (!playId.current) return;

    await fetch(`/api/plays/${playId.current}/frames`, {
      method: "POST",
      body: JSON.stringify({
        frames
      })
    });

  }

  async function uploadVideo(blob) {

    if (!playId.current) return;

    const form = new FormData();
    form.append("video", blob);

    await fetch(`/api/plays/${playId.current}/media`, {
      method: "POST",
      body: form
    });

  }

  return {
    createSession,
    storeEvent,
    storeFrameBatch,
    uploadVideo,
    playId
  };

}
