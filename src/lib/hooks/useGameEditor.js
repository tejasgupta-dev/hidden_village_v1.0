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
    isPublished: false,
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
      const res = await fetch("/api/levels", {
        credentials: "include",
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Convert array to object keyed by id
        const levelsObj = {};
        data.levels.forEach((level) => {
          levelsObj[level.id] = level;
        });
        setAllAvailableLevels(levelsObj);
      }
    } catch (err) {
      console.error("Error loading levels:", err);
    }
  };

  const loadGame = async (id) => {
    setLoadingGame(true);

    try {
      const isAdmin = user?.roles?.includes("admin");
      
      // Try to get game without PIN first
      let url = `/api/games/${id}`;
      
      // If not admin, check sessionStorage for saved PIN
      if (!isAdmin) {
        const savedPin = sessionStorage.getItem(`editorPin_${id}`) || "";
        if (savedPin) {
          url += `?pin=${encodeURIComponent(savedPin)}`;
        }
      }

      const res = await fetch(url, {
        credentials: "include",
      });

      const data = await res.json();

      // Handle PIN required
      if (res.status === 403 && data.code === "PIN_REQUIRED") {
        const pin = prompt("This game requires a PIN to edit:");
        
        if (!pin) {
          router.replace("/game");
          return;
        }

        // Retry with PIN
        const retryRes = await fetch(`/api/games/${id}?pin=${encodeURIComponent(pin)}`, {
          credentials: "include",
        });

        const retryData = await retryRes.json();

        if (!retryRes.ok) {
          alert(retryData.message || "Invalid PIN");
          router.replace("/game");
          return;
        }

        // Save PIN to sessionStorage
        if (!isAdmin) {
          sessionStorage.setItem(`editorPin_${id}`, pin);
        }

        setGame({ ...retryData.game, id });
        setLoadingGame(false);
        return;
      }

      if (!res.ok || !data.success) {
        alert(data.message || "Failed to load game.");
        router.replace("/game");
        return;
      }

      setGame({ ...data.game, id });
    } catch (err) {
      console.error("Error loading game:", err);
      alert("Unexpected error loading game.");
      router.replace("/game");
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

      setSavingGame(true);

      try {
        const payload = {
          name: game.name,
          keywords: game.keywords,
          description: game.description,
          levelIds: game.levelIds,
          storyline: game.storyline,
          settings: game.settings,
          isPublished: isPublish,
          pin: game.pin,
        };

        // CREATE NEW GAME
        if (isNew || !game.id) {
          const res = await fetch("/api/games", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });

          const data = await res.json();

          if (!res.ok || !data.success) {
            alert(data.message || "Failed to create game.");
            return;
          }

          const newId = data.id;

          setGame((prev) => ({ ...prev, id: newId }));

          // Save PIN to sessionStorage
          if (game.pin && !user?.roles?.includes("admin")) {
            sessionStorage.setItem(`editorPin_${newId}`, game.pin);
          }

          alert(
            isPublish
              ? "Game created and published!"
              : "Game created as draft!"
          );

          router.replace(`/game/edit/${newId}`);
          return;
        }

        // UPDATE EXISTING GAME
        const res = await fetch(`/api/games/${game.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          alert(data.message || "Failed to save game.");
          return;
        }

        // Update PIN in sessionStorage if changed
        if (game.pin && !user?.roles?.includes("admin")) {
          sessionStorage.setItem(`editorPin_${game.id}`, game.pin);
        }

        setGame({ ...data.game, id: game.id });
        alert(isPublish ? "Game published!" : "Draft saved!");
      } catch (err) {
        console.error(err);
        alert("Unexpected error saving game.");
      } finally {
        setSavingGame(false);
      }
    },
    [game, router, user, isNew]
  );

  // DELETE
  const handleDelete = useCallback(async () => {
    if (!game || !game.id) return;

    const confirmed = confirm(
      "Are you sure you want to delete this game? This action cannot be undone."
    );

    if (!confirmed) return;

    setSavingGame(true);

    try {
      const res = await fetch(`/api/games/${game.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Failed to delete game.");
        return;
      }

      alert("Game deleted successfully!");
      
      // Clear PIN from sessionStorage
      if (!user?.roles?.includes("admin")) {
        sessionStorage.removeItem(`editorPin_${game.id}`);
      }
      
      router.replace("/game");
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
        return {
          ...prev,
          levelIds: [...prev.levelIds, levelId],
          storyline: [...prev.storyline, []], // Add empty storyline slot
        };
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