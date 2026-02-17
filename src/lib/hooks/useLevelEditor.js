"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import levelEditor from "../domain/levels/levelEditor";

export const useLevelEditor = (levelId, isNew, userEmail) => {
  const router = useRouter();

  const [level, setLevel] = useState({
    id: null,
    author: userEmail ?? "",
    name: "",
    keywords: "",
    poses: {},
    description: "",
    question: "",
    options: [],
    answers: [],
    isPublished: false,
    pin: "", // draft pin (NOT guaranteed to equal stored session pin)
  });

  const [loadingLevel, setLoadingLevel] = useState(true);
  const [savingLevel, setSavingLevel] = useState(false);
  const [message, setMessage] = useState("");

  // ✅ Prevent double-load / double-prompt in dev StrictMode
  const loadInFlightRef = useRef(false);

  /* ------------------ PIN STORAGE ------------------ */
  const getStoredPin = useCallback((id) => {
    if (typeof window === "undefined" || !id) return "";
    return sessionStorage.getItem(`level_pin_${id}`) || "";
  }, []);

  const setStoredPin = useCallback((id, pin) => {
    if (typeof window === "undefined" || !id) return;
    sessionStorage.setItem(`level_pin_${id}`, pin);
  }, []);

  const clearStoredPin = useCallback((id) => {
    if (typeof window === "undefined" || !id) return;
    sessionStorage.removeItem(`level_pin_${id}`);
  }, []);

  const getErrStatus = (err) =>
    err?.status || err?.response?.status || err?.cause?.status;

  /* ================= LOAD ================= */
  const loadLevel = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    setLoadingLevel(true);

    try {
      if (!levelId) {
        router.replace("/level/menu");
        return;
      }

      // 1) Try stored PIN if we have one
      const storedPin = getStoredPin(levelId);

      if (storedPin) {
        try {
          const res = await levelEditor.load(levelId, { pin: storedPin });
          if (res?.success) {
            setLevel({ ...res.level, id: levelId });
            return;
          }
          // if API returns non-throwing failure (rare), fall through
        } catch (err) {
          // stored pin is wrong or pin required -> clear & fall through to prompt flow
          const status = getErrStatus(err);
          if (status === 403) {
            clearStoredPin(levelId);
          } else {
            throw err;
          }
        }
      }

      // 2) No stored PIN (or it failed). Ask server without PIN.
      let response;
      try {
        response = await levelEditor.load(levelId); // no pin header at all
      } catch (err) {
        // If even no-pin request is forbidden, treat as pin required
        const status = getErrStatus(err);
        if (status !== 403) throw err;
        response = { preview: true, hasPin: true };
      }

      // 3) If protected, prompt user to type PIN (allow retries)
      if (response?.preview && response?.hasPin) {
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
              setLevel({ ...retry.level, id: levelId });
              return;
            }

            alert(retry?.message || "Invalid PIN");
          } catch (err) {
            const status = getErrStatus(err);
            if (status === 403) {
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

      // 4) Normal (unprotected) load
      if (!response?.success) {
        alert(response?.message || "Failed to load level.");
        router.replace("/level/menu");
        return;
      }

      setLevel({ ...response.level, id: levelId });
    } catch (err) {
      console.error("Error loading level:", err);
      alert("Unexpected error loading level.");
      router.replace("/level/menu");
    } finally {
      loadInFlightRef.current = false;
      setLoadingLevel(false);
    }
  }, [levelId, router, getStoredPin, setStoredPin, clearStoredPin]);

  useEffect(() => {
    if (isNew) {
      setLoadingLevel(false);
      return;
    }
    if (levelId) loadLevel();
  }, [levelId, isNew, loadLevel]);

  /* ================= SAVE =================
     handleSave can optionally accept a pinOverride to store in sessionStorage.
     Example: handleSave(true, pinValue)
  */
  const handleSave = useCallback(
    async (publish = false, pinOverride) => {
      if (!level) return;

      setSavingLevel(true);
      setMessage("");

      try {
        let response;

        // Draft pin we want to persist (if provided explicitly, prefer that)
        const pinToStore =
          typeof pinOverride === "string" ? pinOverride : level.pin;

        // PIN used for auth headers when calling API:
        // prefer stored pin (what the server expects now),
        // fall back to pinOverride/draft if user is changing it.
        const storedPin = levelId ? getStoredPin(levelId) : "";
        const authPin = storedPin || pinToStore || "";
        const authOpts = authPin ? { pin: authPin } : undefined;

        if (isNew || !level.id) {
          response = await levelEditor.create({
            ...level,
            isPublished: publish,
          });

          if (response?.success && response?.id) {
            // ✅ allow handleSave to set session pin before navigation
            if (pinToStore) setStoredPin(response.id, pinToStore);
            else clearStoredPin(response.id);

            router.replace(`/level/edit/${response.id}`);
            return;
          }
        } else {
          if (!levelId) {
            setMessage("No level ID for update");
            return;
          }

          try {
            response = await levelEditor.save(
              levelId,
              { ...level, isPublished: publish },
              authOpts
            );
          } catch (err) {
            const status = getErrStatus(err);
            if (status === 403) {
              clearStoredPin(levelId);
              setMessage("PIN required or invalid. Please reload the page.");
              return;
            }
            throw err;
          }

          // ✅ after successful save, update session storage pin (new pin or cleared pin)
          if (response?.success) {
            if (pinToStore) setStoredPin(levelId, pinToStore);
            else clearStoredPin(levelId);
          }
        }

        if (!response?.success) {
          setMessage(response?.message || "Failed to save.");
          return;
        }

        setLevel({ ...response.level, id: response.level.id });
        alert(publish ? "Level published!" : "Draft saved!");
      } catch (err) {
        console.error("Error saving level:", err);
        setMessage(err?.message || "Unexpected error saving.");
      } finally {
        setSavingLevel(false);
      }
    },
    [level, levelId, isNew, router, getStoredPin, setStoredPin, clearStoredPin]
  );

  /* ================= DELETE ================= */
  const handleDelete = async () => {
    if (!window.confirm("Delete this level?")) return;

    if (!levelId) {
      alert("No level ID to delete");
      return;
    }

    try {
      const storedPin = getStoredPin(levelId);
      const opts = storedPin ? { pin: storedPin } : undefined;

      try {
        const response = await levelEditor.delete(levelId, opts);
        if (!response?.success) {
          alert(response?.message || "Failed to delete.");
          return;
        }
      } catch (err) {
        const status = getErrStatus(err);
        if (status === 403) {
          clearStoredPin(levelId);
          alert("PIN required or invalid.");
          return;
        }
        throw err;
      }

      clearStoredPin(levelId);
      alert("Level deleted.");
      router.replace("/level/menu");
    } catch (err) {
      console.error("Error deleting level:", err);
      alert("Unexpected error deleting.");
    }
  };

  /* ================= POSE MANAGEMENT ================= */
  const addPose = (key, value) => {
    setLevel((prev) => ({
      ...prev,
      poses: { ...prev.poses, [key]: value },
    }));
  };

  const updatePose = (key, value) => {
    setLevel((prev) => ({
      ...prev,
      poses: { ...prev.poses, [key]: value },
    }));
  };

  const removePose = (key) => {
    setLevel((prev) => {
      const newPoses = { ...prev.poses };
      delete newPoses[key];
      return { ...prev, poses: newPoses };
    });
  };

  /* ================= OPTION MANAGEMENT ================= */
  const addOption = () => {
    setLevel((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }));
  };

  const updateOption = (index, value) => {
    setLevel((prev) => {
      const newOptions = [...prev.options];
      newOptions[index] = value;
      return { ...prev, options: newOptions };
    });
  };

  const removeOption = (index) => {
    setLevel((prev) => {
      const newOptions = prev.options.filter((_, i) => i !== index);
      const newAnswers = (prev.answers || [])
        .filter((ans) => ans !== index)
        .map((ans) => (ans > index ? ans - 1 : ans));
      return { ...prev, options: newOptions, answers: newAnswers };
    });
  };

  /* ================= ANSWER MANAGEMENT ================= */
  const toggleAnswer = (index) => {
    setLevel((prev) => {
      const answers = prev.answers || [];
      const isCorrect = answers.includes(index);

      if (isCorrect) {
        return { ...prev, answers: answers.filter((ans) => ans !== index) };
      }
      return { ...prev, answers: [...answers, index] };
    });
  };

  const handleBack = () => router.back();

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
    handleSave,
    handleDelete,
    handleBack,
    getStoredPin: () => getStoredPin(levelId),
  };
};
