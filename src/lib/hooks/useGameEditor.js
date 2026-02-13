"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export const useGameEditor = (gameId, isNew, userEmail) => {
  const router = useRouter();

  // -------------------
  // Game state
  // -------------------
  const [game, setGame] = useState({
    id: null,
    name: "",
    author: userEmail ?? "",
    description: "",
    keywords: "",
    pin: "",
    levelIds: [],
    storyline: [],
    settings: {},
    requiresPin: false,
  });

  // -------------------
  // UI state
  // -------------------
  const [loadingGame, setLoadingGame] = useState(true);
  const [savingGame, setSavingGame] = useState(false);
  const [allAvailableLevels, setAllAvailableLevels] = useState({});
  const [expandedLevel, setExpandedLevel] = useState(null);
  const [showAddLevel, setShowAddLevel] = useState(false);

  // -------------------
  // Inline editing
  // -------------------
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");

  // -------------------
  // Load data
  // -------------------
  useEffect(() => {
    loadAvailableLevels();

    if (isNew) {
      setLoadingGame(false);
      return;
    }

    if (gameId) {
      loadGame(gameId);
    }
  }, [gameId, isNew]);

  // ✅ Now uses server API
  const loadAvailableLevels = async () => {
    try {
      const res = await fetch("/api/level/list");
      const data = await res.json();

      if (res.ok && data.success) {
        setAllAvailableLevels(data.data || {});
      }
    } catch (err) {
      console.error("Error loading levels:", err);
    }
  };

  const loadGame = async (id) => {
    setLoadingGame(true);

    try {
      const savedPin = sessionStorage.getItem("editorPin") || "";

      const res = await fetch("/api/game/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          pin: savedPin,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Failed to load game.");
        router.replace("/game/edit/menu");
        return;
      }

      setGame(data.data);

    } catch (err) {
      console.error("Error loading game:", err);
      alert("Unexpected error loading game.");
      router.replace("/game/edit/menu");
    } finally {
      setLoadingGame(false);
    }
  };

  // -------------------
  // Editing
  // -------------------
  const startEditing = useCallback((field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || "");
  }, []);

  const saveEdit = useCallback(() => {
    if (editingField) {
      setGame((prev) => ({ ...prev, [editingField]: editValue }));
      setEditingField(null);
      setEditValue("");
    }
  }, [editingField, editValue]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue("");
  }, []);

  // -------------------
  // Level management
  // -------------------
  const addLevel = useCallback((levelId) => {
    setGame((prev) => {
      if (prev.levelIds.includes(levelId)) {
        alert("Level already added!");
        return prev;
      }
      return { ...prev, levelIds: [...prev.levelIds, levelId] };
    });
    setShowAddLevel(false);
  }, []);

  const removeLevel = useCallback((index) => {
    if (!window.confirm("Remove this level from the game?")) return;

    setGame((prev) => {
      const levelIds = [...prev.levelIds];
      const storyline = [...prev.storyline];

      levelIds.splice(index, 1);
      storyline.splice(index, 1);

      return { ...prev, levelIds, storyline };
    });
  }, []);

  const moveLevel = useCallback((index, direction) => {
    setGame((prev) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.levelIds.length) return prev;

      const levelIds = [...prev.levelIds];
      const storyline = [...prev.storyline];

      [levelIds[index], levelIds[newIndex]] = [
        levelIds[newIndex],
        levelIds[index],
      ];

      [storyline[index], storyline[newIndex]] = [
        storyline[newIndex],
        storyline[index],
      ];

      return { ...prev, levelIds, storyline };
    });
  }, []);

  const toggleExpandLevel = useCallback((levelId) => {
    setExpandedLevel((prev) => (prev === levelId ? null : levelId));
  }, []);

  const getLevelData = useCallback(
    (levelId) => allAvailableLevels[levelId] || { name: "(loading…)" },
    [allAvailableLevels]
  );

  // -------------------
  // Save
  // -------------------
  const handleSave = useCallback(
    async (enteredPin, isPublish = false) => {
      if (!game) return;

      // If editing existing and requires PIN
      if (game.id && game.requiresPin && !enteredPin) {
        alert("PIN required.");
        return;
      }

      setSavingGame(true);

      try {
        const res = await fetch("/api/game/write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: game.id ?? null,
            pin: enteredPin ?? "",
            name: game.name,
            keywords: game.keywords,
            description: game.description,
            levelIds: game.levelIds,
            storyline: game.storyline,
            settings: game.settings,
            isPublished: isPublish,
            newPin: !game.id ? game.pin : undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          alert(data.message || "Failed to save game.");
          return;
        }

        // CREATE MODE
        if (isNew && data.data?.gameId) {
          const newId = data.data.gameId;

          sessionStorage.setItem("editorPin", game.pin || "");

          alert(
            isPublish
              ? "Game created and published!"
              : "Game created as draft!"
          );

          router.replace(`/game/edit/${newId}`);
          return;
        }

        alert(isPublish ? "Game published!" : "Draft saved!");

      } catch (err) {
        console.error(err);
        alert("Unexpected error saving game.");
      } finally {
        setSavingGame(false);
      }
    },
    [game, isNew, router]
  );

  // -------------------
  // Delete
  // -------------------
  const handleDelete = async () => {
    if (!window.confirm("Delete this game?")) return;

    const savedPin = sessionStorage.getItem("editorPin") || "";

    const res = await fetch("/api/game/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: game.id,
        enteredPin: savedPin,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || "Failed to delete game.");
      return;
    }

    alert("Game deleted.");
    router.replace("/game/edit/menu");
  };

  const handleBack = useCallback(() => {
    router.push("/game/edit/menu");
  }, [router]);

  return {
    game,
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
};
