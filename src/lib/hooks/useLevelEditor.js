"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export const useLevelEditor = (levelId, isNew, userEmail) => {
  const router = useRouter();

  // -------------------
  // Level state
  // -------------------
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
    requiresPin: false,
  });

  // -------------------
  // UI state
  // -------------------
  const [loadingLevel, setLoadingLevel] = useState(true);
  const [savingLevel, setSavingLevel] = useState(false);
  const [message, setMessage] = useState("");

  // -------------------
  // Load level
  // -------------------
  useEffect(() => {
    if (isNew) {
      setLoadingLevel(false);
      return;
    }

    if (levelId) loadLevel(levelId);
  }, [levelId, isNew]);

  const loadLevel = async (id) => {
    setLoadingLevel(true);

    try {
      const savedPin = sessionStorage.getItem("editorPin") || "";

      const res = await fetch("/api/level/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          pin: savedPin,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Failed to load level.");
        router.replace("/level/menu");
        return;
      }

      setLevel(data.data);
    } catch (err) {
      console.error("Error loading level:", err);
      alert("Unexpected error loading level.");
      router.replace("/level/menu");
    } finally {
      setLoadingLevel(false);
    }
  };

  // -------------------
  // Pose handlers
  // -------------------
  const addPose = () => {
    const key = `pose${Date.now()}`;
    setLevel((prev) => ({
      ...prev,
      poses: { ...prev.poses, [key]: "" },
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
      const updated = { ...prev.poses };
      delete updated[key];
      return { ...prev, poses: updated };
    });
  };

  // -------------------
  // Options / Answers
  // -------------------
  const addOption = () => {
    setLevel((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }));
  };

  const updateOption = (index, value) => {
    setLevel((prev) => {
      const updated = [...prev.options];
      updated[index] = value;
      return { ...prev, options: updated };
    });
  };

  const removeOption = (index) => {
    setLevel((prev) => {
      const options = prev.options.filter((_, i) => i !== index);
      const answers = prev.answers.filter((a) => a !== index);
      return { ...prev, options, answers };
    });
  };

  const toggleAnswer = (index) => {
    setLevel((prev) => ({
      ...prev,
      answers: prev.answers.includes(index)
        ? prev.answers.filter((a) => a !== index)
        : [...prev.answers, index],
    }));
  };

  // -------------------
  // Save
  // -------------------
  const handleSave = useCallback(
    async (enteredPin, publish = false) => {
      if (!level) return;

      // Require PIN if level already protected
      if (level.id && level.requiresPin && !enteredPin) {
        alert("PIN required.");
        return;
      }

      setSavingLevel(true);
      setMessage("");

      try {
        const res = await fetch("/api/level/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: level.id ?? null,
            pin: enteredPin ?? "",
            newPin: level.pin !== undefined ? level.pin : undefined, // FIXED
            name: level.name,
            keywords: level.keywords,
            poses: level.poses,
            description: level.description,
            question: level.question,
            options: level.options,
            answers: level.answers,
            isPublished: publish,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setMessage(data.message || "Failed to save level.");
          return;
        }

        // Always update session pin after save
        sessionStorage.setItem("editorPin", level.pin || "");

        // CREATE MODE
        if (isNew && data.data?.levelId) {
          const newId = data.data.levelId;

          alert(
            publish
              ? "Level created and published!"
              : "Level created as draft!"
          );

          router.replace(`/level/edit/${newId}`);
          return;
        }

        alert(publish ? "Level published!" : "Draft saved!");
      } catch (err) {
        console.error(err);
        setMessage("Unexpected error saving level.");
      } finally {
        setSavingLevel(false);
      }
    },
    [level, isNew, router]
  );

  // -------------------
  // Delete
  // -------------------
  const handleDelete = async () => {
    if (!window.confirm("Delete this level?")) return;

    const savedPin = sessionStorage.getItem("editorPin") || "";

    const res = await fetch("/api/level/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        levelId: level.id,
        enteredPin: savedPin,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || "Failed to delete level.");
      return;
    }

    alert("Level deleted.");
    router.replace("/level/menu");
  };

  // -------------------
  // Navigation
  // -------------------
  const handleBack = () => {
    router.push("/level/menu");
  };

  return {
    level,
    setLevel,

    loadingLevel,
    savingLevel,
    message,

    // Pose
    addPose,
    updatePose,
    removePose,

    // Options
    addOption,
    updateOption,
    removeOption,
    toggleAnswer,

    // Actions
    handleSave,
    handleDelete,
    handleBack,
  };
};
