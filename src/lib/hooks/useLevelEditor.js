"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import levelEditor from "../domain/levels/levelEditor";

export const useLevelEditor = (levelId, isNew = false, userEmail) => {
  const router = useRouter();

  /* ------------------ CORE STATE ------------------ */
  const [level, setLevel] = useState(null);
  const [loadingLevel, setLoadingLevel] = useState(true);
  const [savingLevel, setSavingLevel] = useState(false);
  const [message, setMessage] = useState("");

  // prevent double prompts in dev StrictMode
  const loadInFlightRef = useRef(false);

  /* ------------------ PIN STORAGE ------------------ */
  const storageKey = (id) => `level_pin_${id}`;

  const getStoredPin = useCallback((id) => {
    if (typeof window === "undefined" || !id) return "";
    return sessionStorage.getItem(storageKey(id)) || "";
  }, []);

  const setStoredPin = useCallback((id, pin) => {
    if (typeof window === "undefined" || !id) return;
    sessionStorage.setItem(storageKey(id), pin);
  }, []);

  const clearStoredPin = useCallback((id) => {
    if (typeof window === "undefined" || !id) return;
    sessionStorage.removeItem(storageKey(id));
  }, []);

  const getErrStatus = (err) =>
    err?.status || err?.response?.status || err?.cause?.status;

  /* ------------------ LOAD LEVEL ------------------ */
  const loadLevel = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    setLoadingLevel(true);
    setMessage("");

    try {
      if (isNew) {
        setLevel({
          id: null,
          author: userEmail ?? "",
          authorUid: "",
          name: "",
          keywords: "",
          poses: {},
          description: "",
          question: "",
          options: [],
          answers: [],
          isPublished: false,
          pin: "",
          pinDirty: false,
        });
        return;
      }

      if (!levelId) {
        router.replace("/level/menu");
        return;
      }

      // 1) Try stored pin first (if any)
      const storedPin = getStoredPin(levelId);

      if (storedPin) {
        try {
          const res = await levelEditor.load(levelId, { pin: storedPin });
          if (res?.success) {
            setLevel({
              ...res.level,
              id: levelId,
              pin: storedPin,
              pinDirty: false,
            });
            return;
          }
        } catch (err) {
          if (getErrStatus(err) === 403) {
            clearStoredPin(levelId);
          } else {
            throw err;
          }
        }
      }

      // 2) Try loading without pin
      let response;
      let status = 200;

      try {
        response = await levelEditor.load(levelId);
      } catch (err) {
        status = getErrStatus(err);
        if (status === 403) {
          response = err?.response?.data || { preview: true, hasPin: true };
        } else {
          throw err;
        }
      }

      // Only prompt when API says PREVIEW
      if (response?.preview === true || status === 403) {
        let attempts = 0;

        while (attempts < 3) {
          const enteredPin = prompt("This level is protected. Enter PIN:");
          if (!enteredPin) {
            router.replace("/level/menu");
            return;
          }

          try {
            const retry = await levelEditor.load(levelId, { pin: enteredPin });
            if (retry?.success) {
              setStoredPin(levelId, enteredPin);
              const stillStored = getStoredPin(levelId);

              setLevel({
                ...retry.level,
                id: levelId,
                pin: stillStored || enteredPin,
                pinDirty: false,
              });
              return;
            }

            alert("Invalid PIN");
          } catch (err) {
            if (getErrStatus(err) === 403) alert("Invalid PIN");
            else throw err;
          }

          attempts += 1;
        }

        router.replace("/level/menu");
        return;
      }

      // 3) Must be accessible
      if (!response?.success) {
        alert(response?.message || "Failed to load level");
        router.replace("/level/menu");
        return;
      }

      const stillStored = getStoredPin(levelId);

      // IMPORTANT: keep pin undefined if no stored pin (avoid accidental overwrite)
      setLevel({
        ...response.level,
        id: levelId,
        pin: stillStored || undefined,
        pinDirty: false,
      });
    } catch (err) {
      console.error("Error loading level:", err);
      alert("Error loading level");
      router.replace("/level/menu");
    } finally {
      loadInFlightRef.current = false;
      setLoadingLevel(false);
    }
  }, [
    levelId,
    isNew,
    router,
    userEmail,
    getStoredPin,
    setStoredPin,
    clearStoredPin,
  ]);

  /* ------------------ SAVE LEVEL ------------------ */
  const handleSave = useCallback(
    async (publish = false) => {
      if (!level) return;
      setSavingLevel(true);
      setMessage("");

      try {
        let response;

        if (isNew) {
          // for NEW levels, sending pin is fine
          const { id, pinDirty, ...draft } = level;
          response = await levelEditor.create({ ...draft, isPublished: publish });

          if (response?.success && response?.id) {
            const newId = response.id;

            const desiredPin = (draft.pin || "").trim();
            if (desiredPin) setStoredPin(newId, desiredPin);
            else clearStoredPin(newId);

            // Editor route is /level/[id]
            router.replace(`/level/${newId}`);
            return;
          }
        } else {
          if (!levelId) throw new Error("Missing levelId for save");

          // Authenticate using stored pin (old pin), even if changing/removing
          const authPin = getStoredPin(levelId);
          const opts = authPin ? { pin: authPin } : undefined;

          // Only send `pin` if user changed it (pinDirty === true)
          const { id, pinDirty, ...draft } = level;
          const payload = { ...draft, isPublished: publish };

          if (!pinDirty) {
            delete payload.pin;
          } else {
            payload.pin = (draft.pin ?? "").toString();
          }

          response = await levelEditor.save(levelId, payload, opts);
          if (!response?.success) throw new Error("Save failed");

          if (pinDirty) {
            const desiredPin = (payload.pin || "").trim();
            if (desiredPin) setStoredPin(levelId, desiredPin);
            else clearStoredPin(levelId);
          }

          const stillStored = getStoredPin(levelId);

          setLevel({
            ...response.level,
            id: levelId,
            pin: stillStored || undefined,
            pinDirty: false,
          });

          alert(publish ? "Level published!" : "Draft saved!");
          return;
        }

        if (!response?.success) throw new Error("Save failed");
      } catch (err) {
        console.error("Error saving level:", err);
        setMessage("Error saving level");
        alert("Error saving level");
      } finally {
        setSavingLevel(false);
      }
    },
    [level, levelId, isNew, router, getStoredPin, setStoredPin, clearStoredPin]
  );

  /* ------------------ DELETE LEVEL ------------------ */
  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this level?")) return;
    if (!levelId) return;

    try {
      const authPin = getStoredPin(levelId);
      const opts = authPin ? { pin: authPin } : undefined;

      const response = await levelEditor.delete(levelId, opts);
      if (!response?.success) throw new Error("Delete failed");

      clearStoredPin(levelId);
      router.replace("/level/menu");
    } catch (err) {
      console.error("Error deleting level:", err);
      alert("Error deleting level");
    }
  }, [levelId, router, getStoredPin, clearStoredPin]);

  /* ------------------ HELPERS ------------------ */
  const addPose = (key, value) => {
    setLevel((prev) => ({ ...prev, poses: { ...(prev?.poses || {}), [key]: value } }));
  };

  const updatePose = (key, value) => {
    setLevel((prev) => ({ ...prev, poses: { ...(prev?.poses || {}), [key]: value } }));
  };

  const removePose = (key) => {
    setLevel((prev) => {
      const newPoses = { ...(prev?.poses || {}) };
      delete newPoses[key];
      return { ...prev, poses: newPoses };
    });
  };

  const addOption = () => {
    setLevel((prev) => ({ ...prev, options: [...(prev?.options || []), ""] }));
  };

  const updateOption = (index, value) => {
    setLevel((prev) => {
      const newOptions = [...(prev?.options || [])];
      newOptions[index] = value;
      return { ...prev, options: newOptions };
    });
  };

  const removeOption = (index) => {
    setLevel((prev) => {
      const newOptions = (prev?.options || []).filter((_, i) => i !== index);
      const newAnswers = (prev?.answers || [])
        .filter((ans) => ans !== index)
        .map((ans) => (ans > index ? ans - 1 : ans));
      return { ...prev, options: newOptions, answers: newAnswers };
    });
  };

  const toggleAnswer = (index) => {
    setLevel((prev) => {
      const answers = prev?.answers || [];
      const isCorrect = answers.includes(index);
      return {
        ...prev,
        answers: isCorrect ? answers.filter((a) => a !== index) : [...answers, index],
      };
    });
  };

  const handleBack = () => router.back();

  /* ------------------ INIT ------------------ */
  useEffect(() => {
    if (levelId || isNew) loadLevel();
  }, [levelId, isNew, loadLevel]);

  return {
    level,
    setLevel,
    loadingLevel,
    savingLevel,
    message,

    addPose,
    updatePose,
    removePose,
    addOption,
    updateOption,
    removeOption,
    toggleAnswer,

    loadLevel,
    handleSave,
    handleDelete,
    handleBack,

    getStoredPin: () => getStoredPin(levelId),
  };
};
