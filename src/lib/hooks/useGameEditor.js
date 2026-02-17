"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { gameEditor } from "../domain/games/gameEditor";

/*
   useGameEditor hook
   - Uses gameEditor domain layer for CRUD
   - Handles preview mode and PIN
   - Manages local state and UI interactions
*/
export function useGameEditor(id, isNew = false, userEmail) {
  const router = useRouter();

  /* ------------------ CORE STATE ------------------ */
  const [game, setGame] = useState(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [savingGame, setSavingGame] = useState(false);
  const [allAvailableLevels, setAllAvailableLevels] = useState({});

  /* ------------------ PIN STORAGE ------------------ */
  const getStoredPin = () => sessionStorage.getItem(`game_pin_${id}`) || "";
  const setStoredPin = (pin) => sessionStorage.setItem(`game_pin_${id}`, pin);
  const clearStoredPin = () => sessionStorage.removeItem(`game_pin_${id}`);

  /* ------------------ LOAD GAME ------------------ */
  const loadGame = useCallback(async () => {
    setLoadingGame(true);

    try {
      if (isNew) {
        setGame({
          name: "",
          description: "",
          keywords: "",
          pin: "",
          levelIds: [],
          storyline: [],
          isPublished: false,
          author: userEmail || "",
        });
        return;
      }

      // Try loading game with stored PIN
      let storedPin = getStoredPin();
      let response = await gameEditor.load(id, { pin: storedPin });

      // Handle preview mode / PIN required
      if (response.preview) {
        const pin = prompt("This game is protected. Enter PIN:");
        if (!pin) {
          router.push("/");
          return;
        }

        response = await gameEditor.load(id, { pin });
        if (!response.success) {
          alert("Invalid PIN");
          router.push("/");
          return;
        }

        setStoredPin(pin);
      }

      if (!response.success) {
        alert("Failed to load game");
        router.push("/");
        return;
      }

      setGame(response.game);
    } catch (err) {
      console.error("Error loading game", err);
      alert("Error loading game");
      router.push("/");
    } finally {
      setLoadingGame(false);
    }
  }, [id, isNew, router, userEmail]);

  /* ------------------ LEVEL DATA ACCESS ------------------ */
  const getLevelData = useCallback(
    (levelId) => {
      return (
        allAvailableLevels[levelId] || {
          id: levelId,
          name: "",
          description: "",
        }
      );
    },
    [allAvailableLevels]
  );

  /* ------------------ SAVE GAME ------------------ */
  const handleSave = async (publish = false) => {
    if (!game) return;
    setSavingGame(true);

    try {
      let response;
      const pin = getStoredPin(); // Get stored PIN for updates

      if (isNew) {
        response = await gameEditor.create({ ...game, isPublished: publish });
        if (response.success) router.push(`/game/edit/${response.game.id}`);
      } else {
        // Pass PIN in options for protected games
        response = await gameEditor.save(
          game.id,
          { ...game, isPublished: publish },
          { pin }
        );
      }

      if (!response.success) throw new Error("Save failed");
      setGame(response.game);

      const pinToStore = game.pin?.trim() || "";
      const storageKeyId = isNew ? response.game.id : id;

      if (pinToStore.length > 0) {
        sessionStorage.setItem(`game_pin_${storageKeyId}`, pinToStore);
      } else {
        sessionStorage.removeItem(`game_pin_${storageKeyId}`);
      }

    } catch (err) {
      console.error("Error saving game", err);
      alert("Error saving game");
    } finally {
      setSavingGame(false);
    }
  };

  /* ------------------ DELETE GAME ------------------ */
  const handleDelete = async () => {
    if (!confirm("Delete this game?")) return;
    try {
      const pin = getStoredPin(); // Get stored PIN for deletion
      const response = await gameEditor.delete(id, { pin });
      if (!response.success) throw new Error("Delete failed");
      clearStoredPin();
      router.push("/");
    } catch (err) {
      console.error("Error deleting game", err);
      alert("Error deleting game");
    }
  };

  /* ------------------ LEVEL MANAGEMENT ------------------ */
  const addLevel = (levelId) => {
    setGame((prev) => ({
      ...prev,
      levelIds: [...(prev.levelIds || []), levelId],
      storyline: [...(prev.storyline || []), []],
    }));
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

  /* ------------------ INIT ------------------ */
  useEffect(() => {
    if (id || isNew) loadGame();
  }, [id, isNew, loadGame]);

  return {
    game,
    setGame,
    loadingGame,
    savingGame,
    allAvailableLevels,
    loadGame,
    handleSave,
    handleDelete,
    addLevel,
    removeLevel,
    getLevelData,
  };
}