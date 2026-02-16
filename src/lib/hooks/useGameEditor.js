"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export function useGameEditor(id, user) {
  const router = useRouter();

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.roles?.includes("admin");

  const getStoredPin = () => sessionStorage.getItem(`editorPin_${id}`) || "";
  const setStoredPin = (pin) => sessionStorage.setItem(`editorPin_${id}`, pin);
  const clearStoredPin = () => sessionStorage.removeItem(`editorPin_${id}`);

  const buildPinHeader = (pin) => {
    if (isAdmin) return {};
    const usePin = pin ?? getStoredPin();
    return usePin ? { "x-game-pin": usePin } : {};
  };

  const loadGame = useCallback(async () => {
    try {
      setLoading(true);

      let res = await fetch(`/api/games/${id}`, {
        credentials: "include",
        headers: buildPinHeader(),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.status === 403) {
        const pin = prompt("Enter game PIN:");
        if (!pin) {
          router.push("/");
          return;
        }

        res = await fetch(`/api/games/${id}`, {
          credentials: "include",
          headers: buildPinHeader(pin),
        });

        if (!res.ok) {
          alert("Invalid PIN");
          router.push("/");
          return;
        }

        setStoredPin(pin);
      }

      if (!res.ok) {
        throw new Error("Failed to load game");
      }

      const data = await res.json();
      setGame(data);
    } catch (err) {
      console.error(err);
      alert("Error loading game");
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [id, router, isAdmin]);

  const saveGame = async (payload) => {
    if (!game) return;

    try {
      setSaving(true);

      const res = await fetch(`/api/games/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...buildPinHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.status === 403) {
        alert("Permission denied");
        return;
      }

      if (!res.ok) {
        throw new Error("Save failed");
      }

      const updated = await res.json();
      setGame(updated);
    } catch (err) {
      console.error(err);
      alert("Error saving game");
    } finally {
      setSaving(false);
    }
  };

  const deleteGame = async () => {
    if (!confirm("Are you sure you want to delete this game?")) return;

    try {
      const res = await fetch(`/api/games/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: buildPinHeader(),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.status === 403) {
        alert("Permission denied");
        return;
      }

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      clearStoredPin();
      router.push("/");
    } catch (err) {
      console.error(err);
      alert("Error deleting game");
    }
  };

  useEffect(() => {
    if (id) loadGame();
  }, [id, loadGame]);

  return {
    game,
    setGame,
    loading,
    saving,
    saveGame,
    deleteGame,
    reload: loadGame,
  };
}
