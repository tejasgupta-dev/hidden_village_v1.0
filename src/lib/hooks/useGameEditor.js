"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";

export const useGameEditor = (gameId, isNew, userEmail) => {
  const router = useRouter();
  const { user } = useAuth();

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

  const [loadingGame, setLoadingGame] = useState(true);
  const [savingGame, setSavingGame] = useState(false);
  const [allAvailableLevels, setAllAvailableLevels] = useState({});
  const [expandedLevel, setExpandedLevel] = useState(null);
  const [showAddLevel, setShowAddLevel] = useState(false);

  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");

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

  const loadAvailableLevels = async () => {
    try {
      const res = await fetch("/api/level/list");
      const data = await res.json();
      if (res.ok && data.success) setAllAvailableLevels(data.data || {});
    } catch (err) {
      console.error("Error loading levels:", err);
    }
  };

  const loadGame = async (id) => {
    setLoadingGame(true);

    try {
      const isAdmin = user?.roles?.includes("admin");
      const savedPin = isAdmin ? "" : sessionStorage.getItem("editorPin") || "";

      const res = await fetch("/api/game/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, pin: savedPin }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Failed to load game.");
        router.replace("/game/edit/menu");
        return;
      }

      // ensure id is stored
      setGame({ ...data.data, id });
    } catch (err) {
      console.error("Error loading game:", err);
      alert("Unexpected error loading game.");
      router.replace("/game/edit/menu");
    } finally {
      setLoadingGame(false);
    }
  };

  // =============================
  // SAVE
  // =============================
  const handleSave = useCallback(
    async (isPublish = false) => {
      if (!game) return;

      const isAdmin = user?.roles?.includes("admin");

      setSavingGame(true);

      try {
        const payload = {
          gameId: game.id ?? null,
          enteredPin: isAdmin ? "" : sessionStorage.getItem("editorPin") || "",
          name: game.name,
          keywords: game.keywords,
          description: game.description,
          levelIds: game.levelIds,
          storyline: game.storyline,
          settings: game.settings,
          isPublished: isPublish,
          newPin: game.pin,
        };

        const res = await fetch("/api/game/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          alert(data.message || "Failed to save game.");
          return;
        }

        // NEW GAME CREATED
        if (!game.id && data.gameId) {
          const newId = data.gameId;

          setGame((prev) => ({ ...prev, id: newId }));

          if (!isAdmin) {
            sessionStorage.setItem("editorPin", game.pin || "");
          }

          alert(
            isPublish
              ? "Game created and published!"
              : "Game created as draft!"
          );

          router.replace(`/game/edit/${newId}`);
          return;
        }

        // UPDATE
        alert(isPublish ? "Game published!" : "Draft saved!");
      } catch (err) {
        console.error(err);
        alert("Unexpected error saving game.");
      } finally {
        setSavingGame(false);
      }
    },
    [game, router, user]
  );

  // DELETE
  const handleDelete = useCallback(async () => {
    if (!game || !game.id) return;

    const confirmed = confirm(
      "Are you sure you want to delete this game? This action cannot be undone."
    );

    if (!confirmed) return;

    const isAdmin = user?.roles?.includes("admin");

    setSavingGame(true);

    try {
      const res = await fetch("/api/game/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: game.id,
          pin: isAdmin ? "" : sessionStorage.getItem("editorPin") || "",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Failed to delete game.");
        return;
      }

      alert("Game deleted successfully!");
      
      if (!isAdmin) {
        sessionStorage.removeItem("editorPin");
      }
      
      router.replace("/game/edit/menu");
    } catch (err) {
      console.error("Error deleting game:", err);
      alert("Unexpected error deleting game.");
    } finally {
      setSavingGame(false);
    }
  }, [game, router, user]);

  // BACK
  const handleBack = () => router.back();

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
    startEditing: (field, value) => {
      setEditingField(field);
      setEditValue(value || "");
    },
    saveEdit: () => {
      if (editingField) {
        setGame((prev) => ({ ...prev, [editingField]: editValue }));
        setEditingField(null);
        setEditValue("");
      }
    },
    cancelEdit: () => {
      setEditingField(null);
      setEditValue("");
    },
    addLevel: (levelId) => {
      setGame((prev) => {
        if (prev.levelIds.includes(levelId)) return prev;
        return { ...prev, levelIds: [...prev.levelIds, levelId] };
      });
      setShowAddLevel(false);
    },
    removeLevel: (index) => {
      setGame((prev) => {
        const levelIds = [...prev.levelIds];
        const storyline = [...prev.storyline];
        levelIds.splice(index, 1);
        storyline.splice(index, 1);
        return { ...prev, levelIds, storyline };
      });
    },
    moveLevel: (index, direction) => {
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
    },
    toggleExpandLevel: (levelId) => {
      setExpandedLevel((prev) => (prev === levelId ? null : levelId));
    },
    getLevelData: (levelId) =>
      allAvailableLevels[levelId] || { name: "(loading…)" },
    handleSave,
    handleDelete,
    handleBack,
  };
};