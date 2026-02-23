"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import levelEditor from "../domain/levels/levelEditor";

/* ------------------ DEFAULT LEVEL SETTINGS (single source of truth) ------------------ */
export const DEFAULT_LEVEL_SETTINGS = {
  logFPS: 12,

  include: {
    hands: true,
    face: false,
    leftArm: true,
    leftLeg: false,
    rightArm: true,
    rightLeg: false,
  },

  states: {
    intro: true,
    intuition: true,
    tween: true,
    poseMatch: true,
    insight: true,
    outro: true,
  },

  reps: {
    poseMatch: 2,
    tween: 2,
  },

  ui: {
    dialogueFontSize: 20,
  },
};

/* ------------------ small shared utils ------------------ */
const storageKey = (id) => `level_pin_${id}`;

const getErrStatus = (err) =>
  err?.status || err?.response?.status || err?.cause?.status;

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// Deep merge but only for plain objects; arrays/other types get overwritten
function deepMerge(base, patch) {
  if (!isPlainObject(base)) return patch;
  if (!isPlainObject(patch)) return patch ?? base;

  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(base[k])) out[k] = deepMerge(base[k], v);
    else out[k] = v;
  }
  return out;
}

export const useLevelEditor = (levelId, isNew = false, userEmail) => {
  const router = useRouter();

  /* ------------------ CORE STATE ------------------ */
  const [level, setLevel] = useState(null);
  const [loadingLevel, setLoadingLevel] = useState(true);
  const [savingLevel, setSavingLevel] = useState(false);
  const [message, setMessage] = useState("");

  // PIN gate state (UI handled by page, no prompt/alert in hook)
  const [needsPin, setNeedsPin] = useState(false);
  const [pinError, setPinError] = useState(""); // e.g., "Invalid PIN"

  // prevent double loads in dev StrictMode
  const loadInFlightRef = useRef(false);

  /* ------------------ NEW LEVEL TEMPLATE ------------------ */
  const NEW_LEVEL = useMemo(
    () => ({
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
      settings: DEFAULT_LEVEL_SETTINGS,
    }),
    [userEmail]
  );

  /* ------------------ PIN STORAGE ------------------ */
  const getStoredPinFor = useCallback((id) => {
    if (typeof window === "undefined" || !id) return "";
    return sessionStorage.getItem(storageKey(id)) || "";
  }, []);

  const setStoredPinFor = useCallback((id, pin) => {
    if (typeof window === "undefined" || !id) return;
    sessionStorage.setItem(storageKey(id), pin);
  }, []);

  const clearStoredPinFor = useCallback((id) => {
    if (typeof window === "undefined" || !id) return;
    sessionStorage.removeItem(storageKey(id));
  }, []);

  // convenience wrappers (current id)
  const getStoredPin = useCallback(() => getStoredPinFor(levelId), [getStoredPinFor, levelId]);
  const setStoredPin = useCallback((pin) => setStoredPinFor(levelId, pin), [setStoredPinFor, levelId]);
  const clearStoredPin = useCallback(() => clearStoredPinFor(levelId), [clearStoredPinFor, levelId]);

  /* ------------------ NAV ------------------ */
  const redirectToMenu = useCallback(() => {
    router.replace("/level/menu");
  }, [router]);

  const handleBack = useCallback(() => router.back(), [router]);

  /* ------------------ LEVEL SETTERS ------------------ */
  const setLoadedLevel = useCallback((rawLevel, { id, pin, pinDirty = false } = {}) => {
    setLevel({
      ...rawLevel,
      id: id ?? rawLevel?.id ?? null,
      // IMPORTANT: keep pin undefined if none stored (avoid accidental overwrite)
      pin: pin ? pin : undefined,
      pinDirty,
    });
  }, []);

  /* ------------------ API CALL HELPERS ------------------ */
  const tryLoad = useCallback(async (id, pin) => {
    const opts = pin ? { pin } : undefined;
    return await levelEditor.load(id, opts);
  }, []);

  const gateForPin = useCallback(() => {
    setNeedsPin(true);
    setPinError("");
  }, []);

  const clearPinGate = useCallback(() => {
    setNeedsPin(false);
    setPinError("");
  }, []);

  /* ------------------ LOAD LEVEL ------------------ */
  const loadLevel = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    setLoadingLevel(true);
    setMessage("");
    clearPinGate();

    try {
      if (isNew) {
        setLevel(NEW_LEVEL);
        return;
      }

      if (!levelId) {
        redirectToMenu();
        return;
      }

      // 1) Try stored pin first (if any)
      const storedPin = getStoredPinFor(levelId);
      if (storedPin) {
        try {
          const res = await tryLoad(levelId, storedPin);
          if (res?.success) {
            setLoadedLevel(res.level, { id: levelId, pin: storedPin, pinDirty: false });
            return;
          }
        } catch (err) {
          if (getErrStatus(err) === 403) {
            clearStoredPinFor(levelId);
          } else {
            throw err;
          }
        }
      }

      // 2) Try loading without pin
      try {
        const response = await tryLoad(levelId);
        if (!response?.success) {
          setMessage(response?.message || "Failed to load level");
          redirectToMenu();
          return;
        }

        const stillStored = getStoredPinFor(levelId);
        setLoadedLevel(response.level, { id: levelId, pin: stillStored || undefined, pinDirty: false });
        return;
      } catch (err) {
        const status = getErrStatus(err);

        // protected → page should show pin UI
        if (status === 403) {
          gateForPin();
          return;
        }

        throw err;
      }
    } catch (err) {
      console.error("Error loading level:", err);
      setMessage("Error loading level");
      redirectToMenu();
    } finally {
      loadInFlightRef.current = false;
      setLoadingLevel(false);
    }
  }, [
    levelId,
    isNew,
    NEW_LEVEL,
    redirectToMenu,
    getStoredPinFor,
    clearStoredPinFor,
    tryLoad,
    setLoadedLevel,
    gateForPin,
    clearPinGate,
  ]);

  /* ------------------ PIN FLOW (page-controlled UI) ------------------ */
  const submitPin = useCallback(
    async (pinInput) => {
      if (!levelId) return { success: false, error: "Missing levelId" };

      const pin = (pinInput ?? "").toString().trim();
      if (!pin) {
        setPinError("Enter a PIN");
        return { success: false, error: "empty_pin" };
      }

      setPinError("");
      setMessage("");

      try {
        const res = await tryLoad(levelId, pin);
        if (!res?.success) {
          setPinError("Invalid PIN");
          return { success: false, error: "invalid_pin" };
        }

        setStoredPinFor(levelId, pin);
        const stillStored = getStoredPinFor(levelId);

        setLoadedLevel(res.level, { id: levelId, pin: stillStored || pin, pinDirty: false });
        clearPinGate();
        return { success: true };
      } catch (err) {
        if (getErrStatus(err) === 403) {
          setPinError("Invalid PIN");
          return { success: false, error: "invalid_pin" };
        }
        console.error("Error submitting PIN:", err);
        setPinError("Error verifying PIN");
        return { success: false, error: "pin_error" };
      }
    },
    [levelId, tryLoad, setStoredPinFor, getStoredPinFor, setLoadedLevel, clearPinGate]
  );

  const cancelPin = useCallback(() => {
    // if user cancels PIN entry, we route out (page can call this)
    redirectToMenu();
  }, [redirectToMenu]);

  /* ------------------ SETTINGS (centralized) ------------------ */
  const safeSettings = useMemo(() => {
    const fromLevel = level?.settings ?? {};
    return deepMerge(DEFAULT_LEVEL_SETTINGS, fromLevel);
  }, [level?.settings]);

  const updateSettings = useCallback((patch) => {
    setLevel((prev) => {
      const prevSettings = deepMerge(DEFAULT_LEVEL_SETTINGS, prev?.settings ?? {});
      const nextSettings = deepMerge(prevSettings, patch);
      return { ...prev, settings: nextSettings };
    });
  }, []);

  const resetSettings = useCallback(() => {
    setLevel((prev) => ({ ...prev, settings: DEFAULT_LEVEL_SETTINGS }));
  }, []);

  /* ------------------ SAVE LEVEL ------------------ */
  const handleSave = useCallback(
    async (publish = false) => {
      if (!level) return { success: false, error: "no_level" };

      setSavingLevel(true);
      setMessage("");

      try {
        let response;

        if (isNew) {
          const { id, pinDirty, ...draft } = level;
          response = await levelEditor.create({ ...draft, isPublished: publish });

          if (response?.success && response?.id) {
            const newId = response.id;

            const desiredPin = (draft.pin || "").trim();
            if (desiredPin) setStoredPinFor(newId, desiredPin);
            else clearStoredPinFor(newId);

            router.replace(`/level/${newId}`);
            return { success: true, id: newId };
          }

          setMessage(response?.message || "Create failed");
          return { success: false, error: "create_failed" };
        }

        if (!levelId) {
          setMessage("Missing levelId for save");
          return { success: false, error: "missing_level_id" };
        }

        // Authenticate using stored pin (old pin), even if changing/removing
        const authPin = getStoredPinFor(levelId);
        const opts = authPin ? { pin: authPin } : undefined;

        const { id, pinDirty, ...draft } = level;
        const payload = { ...draft, isPublished: publish };

        // Only send pin if changed
        if (!pinDirty) {
          delete payload.pin;
        } else {
          payload.pin = (draft.pin ?? "").toString();
        }

        response = await levelEditor.save(levelId, payload, opts);

        if (!response?.success) {
          setMessage(response?.message || "Save failed");
          return { success: false, error: "save_failed" };
        }

        if (pinDirty) {
          const desiredPin = (payload.pin || "").trim();
          if (desiredPin) setStoredPinFor(levelId, desiredPin);
          else clearStoredPinFor(levelId);
        }

        const stillStored = getStoredPinFor(levelId);
        setLoadedLevel(response.level, { id: levelId, pin: stillStored || undefined, pinDirty: false });

        return { success: true };
      } catch (err) {
        console.error("Error saving level:", err);
        setMessage("Error saving level");
        return { success: false, error: "save_error" };
      } finally {
        setSavingLevel(false);
      }
    },
    [level, levelId, isNew, router, getStoredPinFor, setStoredPinFor, clearStoredPinFor, setLoadedLevel]
  );

  /* ------------------ DELETE LEVEL (no confirm here) ------------------ */
  const handleDelete = useCallback(async () => {
    if (!levelId) return { success: false, error: "missing_level_id" };

    try {
      const authPin = getStoredPinFor(levelId);
      const opts = authPin ? { pin: authPin } : undefined;

      const response = await levelEditor.delete(levelId, opts);
      if (!response?.success) {
        setMessage(response?.message || "Delete failed");
        return { success: false, error: "delete_failed" };
      }

      clearStoredPinFor(levelId);
      router.replace("/level/menu");
      return { success: true };
    } catch (err) {
      console.error("Error deleting level:", err);
      setMessage("Error deleting level");
      return { success: false, error: "delete_error" };
    }
  }, [levelId, router, getStoredPinFor, clearStoredPinFor]);

  /* ------------------ EDIT HELPERS ------------------ */
  const setPose = useCallback((key, value) => {
    setLevel((prev) => ({
      ...prev,
      poses: { ...(prev?.poses || {}), [key]: value },
    }));
  }, []);

  const removePose = useCallback((key) => {
    setLevel((prev) => {
      const poses = { ...(prev?.poses || {}) };
      delete poses[key];
      return { ...prev, poses };
    });
  }, []);

  const addOption = useCallback(() => {
    setLevel((prev) => ({ ...prev, options: [...(prev?.options || []), ""] }));
  }, []);

  const updateOption = useCallback((index, value) => {
    setLevel((prev) => {
      const options = [...(prev?.options || [])];
      options[index] = value;
      return { ...prev, options };
    });
  }, []);

  const removeOption = useCallback((index) => {
    setLevel((prev) => {
      const options = (prev?.options || []).filter((_, i) => i !== index);
      const answers = (prev?.answers || [])
        .filter((ans) => ans !== index)
        .map((ans) => (ans > index ? ans - 1 : ans));
      return { ...prev, options, answers };
    });
  }, []);

  const toggleAnswer = useCallback((index) => {
    setLevel((prev) => {
      const answers = prev?.answers || [];
      const next = answers.includes(index) ? answers.filter((a) => a !== index) : [...answers, index];
      return { ...prev, answers: next };
    });
  }, []);

  /* ------------------ INIT ------------------ */
  useEffect(() => {
    if (levelId || isNew) loadLevel();
  }, [levelId, isNew, loadLevel]);

  /* ------------------ RETURN API ------------------ */
  return {
    // state
    level,
    setLevel,
    loadingLevel,
    savingLevel,
    message,

    // pin gate (page should render modal/inline UI)
    needsPin,
    pinError,
    submitPin,
    cancelPin,
    clearPinGate,

    // settings helpers (keeps page clean)
    safeSettings,
    updateSettings,
    resetSettings,

    // editor helpers
    setPose,
    removePose,
    addOption,
    updateOption,
    removeOption,
    toggleAnswer,

    // lifecycle
    loadLevel,
    handleSave,
    handleDelete,
    handleBack,

    // pin helpers (still useful for page.jsx)
    getStoredPin,
    setStoredPin,
    clearStoredPin,
  };
};