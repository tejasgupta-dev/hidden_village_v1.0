"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export function useGameEditor(id, isNew = false, userEmail) {
  const router = useRouter();

  /* =======================================================
     CORE STATE
  ======================================================= */

  const [game, setGame] = useState(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [savingGame, setSavingGame] = useState(false);

  const [allAvailableLevels, setAllAvailableLevels] = useState({});

  /* =======================================================
     UI STATE
  ======================================================= */

  const [showAddLevel, setShowAddLevel] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState(null);

  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");

  /* =======================================================
     PIN STORAGE
  ======================================================= */

  const getStoredPin = () =>
    sessionStorage.getItem(`game_pin_${id}`) || "";

  const setStoredPin = (pin) =>
    sessionStorage.setItem(`game_pin_${id}`, pin);

  const clearStoredPin = () =>
    sessionStorage.removeItem(`game_pin_${id}`);

  const buildPinHeader = (pin) => {
    const usePin = pin ?? getStoredPin();
    return usePin ? { "x-game-pin": usePin } : {};
  };

  /* =======================================================
     LOAD GAME
  ======================================================= */

  const loadGame = useCallback(async () => {
    try {
      setLoadingGame(true);

      if (isNew) {
        setGame({
          name: "",
          description: "",
          keywords: "",
          pin: "",
          levelIds: [],
          storyline: [],
          published: false,
          author: userEmail || "",
        });
        return;
      }

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

      if (!res.ok) throw new Error("Failed to load game");

      const data = await res.json();
      setGame(data.game);

    } catch (err) {
      console.error(err);
      alert("Error loading game");
      router.push("/");
    } finally {
      setLoadingGame(false);
    }
  }, [id, isNew, router, userEmail]);

  /* =======================================================
     LOAD AVAILABLE LEVELS
  ======================================================= */

  const loadLevels = useCallback(async () => {
    try {
      const res = await fetch("/api/levels");
      if (!res.ok) return;

      const data = await res.json();
      setAllAvailableLevels(data.levels || {});
    } catch (err) {
      console.error("Failed to load levels", err);
    }
  }, []);

  /* =======================================================
     SAVE
  ======================================================= */

  const handleSave = async (publish = false) => {
    if (!game) return;

    try {
      setSavingGame(true);

      const res = await fetch(
        isNew ? "/api/games" : `/api/games/${id}`,
        {
          method: isNew ? "POST" : "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...buildPinHeader(),
          },
          body: JSON.stringify({
            ...game,
            published: publish,
          }),
        }
      );

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.status === 403) {
        alert("Permission denied");
        return;
      }

      if (!res.ok) throw new Error("Save failed");

      const data = await res.json();
      setGame(data.game);

      if (isNew) router.push(`/game/edit/${data.game.id}`);

    } catch (err) {
      console.error(err);
      alert("Error saving game");
    } finally {
      setSavingGame(false);
    }
  };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete = async () => {
    if (!confirm("Delete this game?")) return;

    try {
      const res = await fetch(`/api/games/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: buildPinHeader(),
      });

      if (!res.ok) throw new Error("Delete failed");

      clearStoredPin();
      router.push("/");

    } catch (err) {
      console.error(err);
      alert("Error deleting game");
    }
  };

  const handleBack = () => router.push("/");

  /* =======================================================
     FIELD EDITING
  ======================================================= */

  const startEditing = (field, value) => {
    setEditingField(field);
    setEditValue(value ?? "");
  };

  const saveEdit = () => {
    if (!editingField) return;

    setGame((prev) => ({
      ...prev,
      [editingField]: editValue,
    }));

    setEditingField(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  /* =======================================================
     LEVEL MANAGEMENT
  ======================================================= */

  const addLevel = (levelId) => {
    setGame((prev) => ({
      ...prev,
      levelIds: [...(prev.levelIds || []), levelId],
      storyline: [...(prev.storyline || []), []],
    }));

    setShowAddLevel(false);
  };

  const removeLevel = (index) => {
    setGame((prev) => {
      const newLevels = [...(prev.levelIds || [])];
      const newStory = [...(prev.storyline || [])];

      newLevels.splice(index, 1);
      newStory.splice(index, 1);

      return { ...prev, levelIds: newLevels, storyline: newStory };
    });
  };

  const moveLevel = (index, direction) => {
    setGame((prev) => {
      const newLevels = [...(prev.levelIds || [])];
      const newStory = [...(prev.storyline || [])];
      const newIndex = index + direction;

      if (newIndex < 0 || newIndex >= newLevels.length) return prev;

      [newLevels[index], newLevels[newIndex]] = [
        newLevels[newIndex],
        newLevels[index],
      ];

      [newStory[index], newStory[newIndex]] = [
        newStory[newIndex],
        newStory[index],
      ];

      return { ...prev, levelIds: newLevels, storyline: newStory };
    });
  };

  const toggleExpandLevel = (levelId) => {
    setExpandedLevel((prev) =>
      prev === levelId ? null : levelId
    );
  };

  const getLevelData = (levelId) =>
    allAvailableLevels[levelId] || {};

  /* =======================================================
     INIT
  ======================================================= */

  useEffect(() => {
    if (id || isNew) loadGame();
  }, [id, isNew, loadGame]);

  useEffect(() => {
    loadLevels();
  }, [loadLevels]);

  /* =======================================================
     RETURN
  ======================================================= */

  return {
    game,
    setGame,
    loadingGame,
    savingGame,
    allAvailableLevels,
    expandedLevel,
    showAddLevel,
    setShowAddLevel,
    editingField,
    editValue,
    setEditValue,
    startEditing,
    saveEdit,
    cancelEdit,
    addLevel,
    removeLevel,
    moveLevel,
    toggleExpandLevel,
    getLevelData,
    handleSave,
    handleDelete,
    handleBack,
  };
}
