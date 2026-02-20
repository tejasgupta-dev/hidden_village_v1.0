"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import levelEditor from "../domain/levels/levelEditor";

const isPlainObject = (v) =>
  !!v && typeof v === "object" && !Array.isArray(v);

const clamp = (n, min, max) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
};

const normalizeTFEnabled = (v) => v === true || v === "true";
const normalizeTFAnswer = (v) => {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return null;
};

const normalizePoseToleranceMap = (v) => {
  if (!isPlainObject(v)) return {};
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    // keep only string-ish keys
    const key = String(k);
    out[key] = clamp(val, 0, 100);
  }
  return out;
};

// Removes UI-only keys and ensures shape is safe to send
const buildSavePayload = (level, publish) => {
  const draft = { ...(level ?? {}) };

  // UI-only / server-only fields you don’t want to persist from the editor
  delete draft.id;
  delete draft.pinDirty;
  delete draft.hasPin;
  delete draft.preview;

  // normalize arrays/objects
  if (!Array.isArray(draft.options)) draft.options = [];
  if (!Array.isArray(draft.answers)) draft.answers = [];
  if (!isPlainObject(draft.poses)) draft.poses = {};

  // new fields (robust normalization)
  draft.trueFalseEnabled = normalizeTFEnabled(draft.trueFalseEnabled);
  draft.trueFalseAnswer = normalizeTFAnswer(draft.trueFalseAnswer);
  draft.poseTolerancePctById = normalizePoseToleranceMap(draft.poseTolerancePctById);

  // final publish flag
  draft.isPublished = !!publish;

  return draft;
};

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

          // PIN support
          pin: "",
          pinDirty: false,

          // ✅ new fields defaults
          trueFalseEnabled: false,
          trueFalseAnswer: null,
          poseTolerancePctById: {},
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
              // keep visible pin from storage only
              pin: storedPin,
              // not dirty unless user edits in UI
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
          // NEW levels: include pin + new fields
          const payload = buildSavePayload(level, publish);

          response = await levelEditor.create(payload);

          if (response?.success && response?.id) {
            const newId = response.id;

            const desiredPin = (payload.pin || "").trim();
            if (desiredPin) setStoredPin(newId, desiredPin);
            else clearStoredPin(newId);

            router.replace(`/level/edit/${newId}`);
            return;
          }

          if (!response?.success) throw new Error("Create failed");
          return;
        }

        // Existing level
        if (!levelId) throw new Error("Missing levelId for save");

        // Authenticate using stored pin (old pin), even if changing/removing
        const authPin = getStoredPin(levelId);
        const opts = authPin ? { pin: authPin } : undefined;

        const payload = buildSavePayload(level, publish);

        // ✅ critical pin rule:
        // only send pin if user actually changed it
        if (!level.pinDirty) {
          delete payload.pin;
        } else {
          payload.pin = (level.pin ?? "").toString();
        }

        response = await levelEditor.save(levelId, payload, opts);
        if (!response?.success) throw new Error("Save failed");

        // After success, mirror draft pin to storage ONLY if user changed it
        if (level.pinDirty) {
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
    setLevel((prev) => ({
      ...prev,
      poses: { ...(prev?.poses || {}), [key]: value },
    }));
  };

  const updatePose = (key, value) => {
    setLevel((prev) => ({
      ...prev,
      poses: { ...(prev?.poses || {}), [key]: value },
    }));
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
