"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { gameEditor } from "../domain/games/gameEditor";

export function useGameEditor(id, isNew = false, userEmail) {
  const router = useRouter();

  /* ------------------ CORE STATE ------------------ */
  const [game, setGame] = useState(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [savingGame, setSavingGame] = useState(false);
  const [allAvailableLevels, setAllAvailableLevels] = useState({});

  // ✅ prevent double prompts in dev StrictMode
  const loadInFlightRef = useRef(false);

  /* ------------------ PIN STORAGE ------------------ */
  const storageKey = (gameId) => `game_pin_${gameId}`;

  const getStoredPin = useCallback((gameId) => {
    if (typeof window === "undefined" || !gameId) return "";
    return sessionStorage.getItem(storageKey(gameId)) || "";
  }, []);

  const setStoredPin = useCallback((gameId, pin) => {
    if (typeof window === "undefined" || !gameId) return;
    sessionStorage.setItem(storageKey(gameId), pin);
  }, []);

  const clearStoredPin = useCallback((gameId) => {
    if (typeof window === "undefined" || !gameId) return;
    sessionStorage.removeItem(storageKey(gameId));
  }, []);

  const getErrStatus = (err) =>
    err?.status || err?.response?.status || err?.cause?.status;

  /* ------------------ LOAD GAME ------------------ */
  const loadGame = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

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

      if (!id) {
        router.push("/");
        return;
      }

      // 1) Try stored pin first (if any)
      const storedPin = getStoredPin(id);

      if (storedPin) {
        try {
          const res = await gameEditor.load(id, { pin: storedPin });
          if (res?.success) {
            // ✅ seed UI pin from stored pin (server may not return it)
            setGame({ ...res.game, pin: storedPin });
            return;
          }
        } catch (err) {
          // stored pin bad => clear and fall through to prompt flow
          if (getErrStatus(err) === 403) {
            clearStoredPin(id);
          } else {
            throw err;
          }
        }
      }

      // 2) Try loading without pin (may return preview OR may throw 403)
      let response;
      try {
        response = await gameEditor.load(id);
      } catch (err) {
        if (getErrStatus(err) === 403) {
          response = { preview: true, hasPin: true };
        } else {
          throw err;
        }
      }

      // 3) If protected, prompt user to type pin (allow retries)
      if (response?.preview || response?.hasPin) {
        let attempts = 0;

        while (attempts < 3) {
          const enteredPin = prompt("This game is protected. Enter PIN:");
          if (!enteredPin) {
            router.push("/");
            return;
          }

          try {
            const retry = await gameEditor.load(id, { pin: enteredPin });
            if (retry?.success) {
              setStoredPin(id, enteredPin);
              setGame({ ...retry.game, pin: enteredPin });
              return;
            }
            alert("Invalid PIN");
          } catch (err) {
            if (getErrStatus(err) === 403) {
              alert("Invalid PIN");
            } else {
              throw err;
            }
          }

          attempts += 1;
        }

        router.push("/");
        return;
      }

      // 4) Unprotected load
      if (!response?.success) {
        alert(response?.message || "Failed to load game");
        router.push("/");
        return;
      }

      const stillStored = getStoredPin(id);
      setGame({ ...response.game, pin: stillStored || "" });
    } catch (err) {
      console.error("Error loading game", err);
      alert("Error loading game");
      router.push("/");
    } finally {
      loadInFlightRef.current = false;
      setLoadingGame(false);
    }
  }, [id, isNew, router, userEmail, getStoredPin, setStoredPin, clearStoredPin]);

  /* ------------------ SAVE GAME ------------------ */
  const handleSave = useCallback(
    async (publish = false) => {
      if (!game) return;
      setSavingGame(true);

      try {
        let response;

        if (isNew) {
          response = await gameEditor.create({ ...game, isPublished: publish });

          if (response?.success && response?.game?.id) {
            const newId = response.game.id;

            // ✅ after success, mirror "draft pin" to sessionStorage
            const desiredPin = (game.pin || "").trim();
            if (desiredPin) setStoredPin(newId, desiredPin);
            else clearStoredPin(newId);

            router.push(`/game/edit/${newId}`);
            return;
          }
        } else {
          // ✅ IMPORTANT:
          // Always authenticate using the currently stored pin (old pin),
          // even if user is removing/changing it in the draft.
          const authPin = getStoredPin(id);
          const opts = authPin ? { pin: authPin } : undefined;

          response = await gameEditor.save(
            game.id,
            { ...game, isPublished: publish },
            opts
          );

          if (!response?.success) throw new Error("Save failed");

          // ✅ after success, mirror "draft pin" to sessionStorage
          const desiredPin = (game.pin || "").trim();
          if (desiredPin) setStoredPin(id, desiredPin);
          else clearStoredPin(id);

          // keep UI pin stable (server may not return pin)
          const stillStored = getStoredPin(id);
          setGame({ ...response.game, pin: stillStored || "" });
          return;
        }

        if (!response?.success) throw new Error("Save failed");
        setGame(response.game);
      } catch (err) {
        console.error("Error saving game", err);
        alert("Error saving game");
      } finally {
        setSavingGame(false);
      }
    },
    [game, id, isNew, router, getStoredPin, setStoredPin, clearStoredPin]
  );

  /* ------------------ DELETE GAME ------------------ */
  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this game?")) return;
    if (!id) return;

    try {
      const authPin = getStoredPin(id);
      const opts = authPin ? { pin: authPin } : undefined;

      const response = await gameEditor.delete(id, opts);
      if (!response?.success) throw new Error("Delete failed");

      clearStoredPin(id);
      router.push("/");
    } catch (err) {
      console.error("Error deleting game", err);
      alert("Error deleting game");
    }
  }, [id, router, getStoredPin, clearStoredPin]);

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
    getLevelData: (levelId) =>
      allAvailableLevels[levelId] || { id: levelId, name: "", description: "" },

    // expose for UI
    getStoredPin: () => getStoredPin(id),
  };
}
