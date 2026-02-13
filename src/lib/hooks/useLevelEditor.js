"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";

export const useLevelEditor = (levelId, isNew, userEmail) => {
  const router = useRouter();
  const { user } = useAuth();

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

  /* ================= LOAD ================= */

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
        body: JSON.stringify({ id, pin: savedPin }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Failed to load level.");
        router.replace("/level/menu");
        return;
      }

      setLevel({ ...data.data, id });
    } catch (err) {
      console.error(err);
      alert("Unexpected error loading level.");
      router.replace("/level/menu");
    } finally {
      setLoadingLevel(false);
    }
  };

  /* ================= POSES ================= */

  const addPose = () => {
    const newKey = `pose_${Date.now()}`;

    setLevel(prev => ({
      ...prev,
      poses: {
        ...(prev.poses || {}),
        [newKey]: "",
      },
    }));
  };

  const updatePose = (key, value) => {
    setLevel(prev => ({
      ...prev,
      poses: {
        ...prev.poses,
        [key]: value,
      },
    }));
  };

  const removePose = (key) => {
    setLevel(prev => {
      const newPoses = { ...prev.poses };
      delete newPoses[key];

      return {
        ...prev,
        poses: newPoses,
      };
    });
  };

  /* ================= OPTIONS ================= */

  const addOption = () => {
    setLevel(prev => ({
      ...prev,
      options: [...(prev.options || []), ""],
    }));
  };

  const updateOption = (index, value) => {
    setLevel(prev => {
      const newOptions = [...prev.options];
      newOptions[index] = value;

      return {
        ...prev,
        options: newOptions,
      };
    });
  };

  const removeOption = (index) => {
    setLevel(prev => {
      const newOptions = prev.options.filter((_, i) => i !== index);

      const newAnswers = prev.answers
        .filter(a => a !== index)
        .map(a => (a > index ? a - 1 : a));

      return {
        ...prev,
        options: newOptions,
        answers: newAnswers,
      };
    });
  };

  const toggleAnswer = (index) => {
    setLevel(prev => {
      const exists = prev.answers.includes(index);

      return {
        ...prev,
        answers: exists
          ? prev.answers.filter(a => a !== index)
          : [...prev.answers, index],
      };
    });
  };

  /* ================= SAVE ================= */

  const handleSave = useCallback(
    async (enteredPin, publish = false) => {
      if (!level) return;

      setSavingLevel(true);
      setMessage("");

      try {
        const payload = {
          id: level.id ?? null,
          pin: level.pin ?? "",
          name: level.name,
          keywords: level.keywords,
          poses: level.poses,
          description: level.description,
          question: level.question,
          options: level.options,
          answers: level.answers,
          isPublished: publish,
        };

        const res = await fetch("/api/level/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setMessage(data.message || "Failed to save level.");
          return;
        }

        if (enteredPin) {
          sessionStorage.setItem("editorPin", enteredPin);
        }

        if (!level.id && data.data?.levelId) {
          const newId = data.data.levelId;

          setLevel((prev) => ({ ...prev, id: newId }));

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
    [level, router]
  );

  /* ================= DELETE ================= */

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
  };
};
