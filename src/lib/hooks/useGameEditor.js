"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { gameEditor } from "../domain/games/gameEditor";
import levelMenu from "../domain/levels/levelMenu";

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

  /* ------------------ LOAD PUBLISHED LEVELS ------------------ */
  useEffect(() => {
    let cancelled = false;

    async function loadPublishedLevels() {
      try {
        const res = (await levelMenu.listPublished?.()) ?? (await levelMenu.list());

        if (cancelled) return;
        if (!res?.success) return;

        const list = res.levels || res.publishedLevels || [];
        const onlyPublished =
          (res.levels || []).length > 0 && (res.publishedLevels || []).length === 0
            ? list.filter((l) => l.isPublished === true)
            : list;

        const map = {};
        for (const lvl of onlyPublished) map[lvl.id] = lvl;
        setAllAvailableLevels(map);
      } catch (e) {
        if (!cancelled) console.error("Failed to load published levels", e);
      }
    }

    loadPublishedLevels();
    return () => {
      cancelled = true;
    };
  }, []);

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
          if (res?.success && res?.preview !== true) {
            setGame(res.game); // ✅ do NOT inject pin into game state
            return;
          }
        } catch (err) {
          if (getErrStatus(err) === 403) {
            clearStoredPin(id);
          } else {
            throw err;
          }
        }
      }

      // 2) Try loading without pin
      let response;
      try {
        response = await gameEditor.load(id);
      } catch (err) {
        // If your apiClient throws on non-2xx, this is where it lands.
        // Only treat as PIN if code is PIN_REQUIRED.
        const status = getErrStatus(err);
        const body = err?.responseBody || err?.data || err?.response?.data;

        if (status === 403 && body?.code === "PIN_REQUIRED") {
          response = { preview: true, hasPin: true };
        } else {
          throw err;
        }
      }

      // 3) If protected (explicit preview), prompt
      if (response?.preview === true) {
        let attempts = 0;

        while (attempts < 3) {
          const enteredPin = prompt("This game is protected. Enter PIN:");
          if (!enteredPin) {
            router.push("/");
            return;
          }

          try {
            const retry = await gameEditor.load(id, { pin: enteredPin });
            if (retry?.success && retry?.preview !== true) {
              setStoredPin(id, enteredPin);
              setGame(retry.game); // ✅ do NOT inject pin into game state
              return;
            }
            alert("Invalid PIN");
          } catch (err) {
            if (getErrStatus(err) === 403) alert("Invalid PIN");
            else throw err;
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

      setGame(response.game); // ✅ do NOT inject stored pin into game state
    } catch (err) {
      console.error("Error loading game", err);
      alert("Error loading game");
      router.push("/");
    } finally {
      loadInFlightRef.current = false;
      setLoadingGame(false);
    }
  }, [
    id,
    isNew,
    router,
    userEmail,
    getStoredPin,
    setStoredPin,
    clearStoredPin,
  ]);

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

            const desiredPin = (game.pin || "").trim();
            if (desiredPin) setStoredPin(newId, desiredPin);
            else clearStoredPin(newId);

            router.push(`/game/edit/${newId}`);
            return;
          }
        } else {
          // Authenticate using stored pin (old pin)
          const authPin = getStoredPin(id);
          const opts = authPin ? { pin: authPin } : undefined;

          response = await gameEditor.save(
            game.id,
            { ...game, isPublished: publish },
            opts
          );

          if (!response?.success) throw new Error("Save failed");

          // Mirror draft pin to sessionStorage after success
          const desiredPin = (game.pin || "").trim();
          if (desiredPin) setStoredPin(id, desiredPin);
          else clearStoredPin(id);

          setGame(response.game);
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

  /* ------------------ UPLOAD ASSET ------------------ */
  const uploadAsset = useCallback(
    async (file, options = {}) => {
      if (!id && !game?.id) throw new Error("Game ID is required to upload assets");

      const gameId = game?.id || id;

      const authPin = getStoredPin(gameId);
      const opts = authPin ? { pin: authPin, ...options } : { ...options };

      return gameEditor.uploadAsset(gameId, file, opts);
    },
    [id, game?.id, getStoredPin]
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
    uploadAsset,

    addLevel,
    removeLevel,

    getLevelData: (levelId) =>
      allAvailableLevels[levelId] || { id: levelId, name: "", description: "" },

    getStoredPin: () => getStoredPin(id || game?.id),
  };
}