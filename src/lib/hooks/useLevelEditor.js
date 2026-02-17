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

  // ✅ prevent double prompts in dev StrictMode
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
          pin: "", // draft pin only (for create)
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
            // ✅ keep UI pin stable from storage (server never returns pin)
            setLevel({ ...res.level, id: levelId, pin: storedPin });
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
        // If your apiClient throws, we still need a shape to continue
        if (status === 403) {
          response = err?.response?.data || { preview: true, hasPin: true };
        } else {
          throw err;
        }
      }

      // ✅ KEY FIX:
      // Only prompt when API says PREVIEW (meaning: you do NOT have access yet)
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
              // Store pin for future auth
              setStoredPin(levelId, enteredPin);

              // ✅ DO NOT inject enteredPin into level state
              // (it makes the UI show random pin and is a security footgun)
              const stillStored = getStoredPin(levelId);
              setLevel({ ...retry.level, id: levelId, pin: stillStored || "" });

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

        router.replace("/level/menu");
        return;
      }

      // 3) Must be accessible (owner/admin/unlocked)
      if (!response?.success) {
        alert(response?.message || "Failed to load level");
        router.replace("/level/menu");
        return;
      }

      const stillStored = getStoredPin(levelId);
      setLevel({ ...response.level, id: levelId, pin: stillStored || "" });
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
          response = await levelEditor.create({ ...level, isPublished: publish });

          if (response?.success && response?.id) {
            const newId = response.id;

            // mirror draft pin to sessionStorage after success
            const desiredPin = (level.pin || "").trim();
            if (desiredPin) setStoredPin(newId, desiredPin);
            else clearStoredPin(newId);

            router.replace(`/level/edit/${newId}`);
            return;
          }
        } else {
          if (!levelId) throw new Error("Missing levelId for save");

          // Authenticate using stored pin (old pin), even if changing/removing
          const authPin = getStoredPin(levelId);
          const opts = authPin ? { pin: authPin } : undefined;

          response = await levelEditor.save(
            levelId,
            { ...level, isPublished: publish },
            opts
          );

          if (!response?.success) throw new Error("Save failed");

          // After success, mirror draft pin to storage
          const desiredPin = (level.pin || "").trim();
          if (desiredPin) setStoredPin(levelId, desiredPin);
          else clearStoredPin(levelId);

          const stillStored = getStoredPin(levelId);
          setLevel({ ...response.level, id: levelId, pin: stillStored || "" });

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
