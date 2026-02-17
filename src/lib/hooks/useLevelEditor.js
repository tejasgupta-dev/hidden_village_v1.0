"use client";

import { useState, useEffect, useCallback } from "react";
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
    pin: "",
  });

  const [loadingLevel, setLoadingLevel] = useState(true);
  const [savingLevel, setSavingLevel] = useState(false);
  const [message, setMessage] = useState("");

  /* ------------------ PIN STORAGE ------------------ */
  // These functions need the levelId parameter to avoid accessing wrong storage keys
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

  /* ================= LOAD ================= */
  const loadLevel = useCallback(async () => {
    setLoadingLevel(true);

    try {
      if (!levelId) {
        console.error("No level ID provided");
        router.replace("/level/menu");
        return;
      }

      // Use stored PIN if available
      const pin = getStoredPin(levelId);
      let response;

      try {
        response = await levelEditor.load(levelId, { pin });
      } catch (err) {
        // If stored PIN is invalid, clear it and try again without PIN
        if (err.code === "INVALID_PIN") {
          clearStoredPin(levelId);
          response = await levelEditor.load(levelId, { pin: "" });
        } else {
          throw err;
        }
      }

      // Handle preview mode / PIN required
      if (response.preview) {
        const enteredPin = prompt("This level is protected. Enter PIN:");
        if (!enteredPin) {
          router.replace("/level/menu");
          return;
        }

        try {
          const retryResponse = await levelEditor.load(levelId, {
            pin: enteredPin,
          });

          if (!retryResponse.success) {
            alert("Invalid PIN");
            clearStoredPin(levelId);
            router.replace("/level/menu");
            return;
          }

          setStoredPin(levelId, enteredPin);
          setLevel({ ...retryResponse.level, id: levelId });
          return;
        } catch (err) {
          alert("Invalid PIN");
          clearStoredPin(levelId);
          router.replace("/level/menu");
          return;
        }
      }

      if (!response.success) {
        alert(response.message || "Failed to load level.");
        router.replace("/level/menu");
        return;
      }

      setLevel({ ...response.level, id: levelId });
    } catch (err) {
      console.error("Error loading level:", err);

      // Clear invalid PIN on error
      if (err.code === "INVALID_PIN" && levelId) {
        clearStoredPin(levelId);
      }

      alert("Unexpected error loading level.");
      router.replace("/level/menu");
    } finally {
      setLoadingLevel(false);
    }
  }, [levelId, router, getStoredPin, setStoredPin, clearStoredPin]);

  useEffect(() => {
    if (isNew) {
      setLoadingLevel(false);
      return;
    }

    if (levelId) {
      loadLevel();
    }
  }, [levelId, isNew, loadLevel]);

  /* ================= SAVE ================= */
  const handleSave = useCallback(
    async (publish = false) => {
      if (!level) return;

      setSavingLevel(true);
      setMessage("");

      try {
        let response;
        const pin = levelId ? getStoredPin(levelId) : ""; // Get stored PIN for updates

        if (isNew || !level.id) {
          response = await levelEditor.create({
            ...level,
            isPublished: publish,
          });

          if (response.success && response.id) {
            // Store PIN for the new level if it has one
            if (level.pin) {
              setStoredPin(response.id, level.pin);
            }
            router.replace(`/level/edit/${response.id}`);
            return;
          }
        } else {
          if (!levelId) {
            setMessage("No level ID for update");
            return;
          }

          // Pass PIN in options for protected levels
          try {
            response = await levelEditor.save(
              levelId,
              { ...level, isPublished: publish },
              { pin }
            );
          } catch (err) {
            // If PIN is invalid, clear it and notify user
            if (err.code === "INVALID_PIN" || err.code === "PIN_REQUIRED") {
              clearStoredPin(levelId);
              setMessage("PIN required or invalid. Please reload the page.");
              return;
            }
            throw err;
          }
        }

        if (!response.success) {
          setMessage(response.message || "Failed to save.");
          return;
        }

        setLevel({ ...response.level, id: response.level.id });
        alert(publish ? "Level published!" : "Draft saved!");
      } catch (err) {
        console.error("Error saving level:", err);
        setMessage(err.message || "Unexpected error saving.");
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
      const pin = getStoredPin(levelId); // Get stored PIN for deletion

      try {
        const response = await levelEditor.delete(levelId, { pin });
        if (!response.success) {
          alert(response.message || "Failed to delete.");
          return;
        }
      } catch (err) {
        // If PIN is invalid, clear it and notify user
        if (err.code === "INVALID_PIN" || err.code === "PIN_REQUIRED") {
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
      // Also remove from answers if it was marked as correct
      const newAnswers = prev.answers
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
      } else {
        return { ...prev, answers: [...answers, index] };
      }
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
    getStoredPin: () => getStoredPin(levelId), // Export bound version for component use
  };
};