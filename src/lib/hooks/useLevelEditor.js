"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { levelEditorApi } from "@/lib/api/levelEditorApi";

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
      // Try to load with saved PIN if available
      const savedPin = sessionStorage.getItem("editorPin");
      const options = savedPin ? { pin: savedPin } : {};

      const { success, level: data } = await levelEditorApi.load(id, options);

      if (!success) {
        alert("Failed to load level.");
        router.replace("/level/menu");
        return;
      }

      setLevel({ ...data, id });
    } catch (err) {
      console.error(err);
      
      // Check if PIN is required
      if (err.message.includes("PIN")) {
        const enteredPin = prompt("This level is PIN protected. Please enter the PIN:");
        if (enteredPin) {
          sessionStorage.setItem("editorPin", enteredPin);
          // Retry loading with PIN
          loadLevel(id);
          return;
        }
      }
      
      alert("Unexpected error loading level.");
      router.replace("/level/menu");
    } finally {
      setLoadingLevel(false);
    }
  };

  /* ================= POSES ================= */

  const addPose = () => {
    const newKey = `pose_${Date.now()}`;

    setLevel((prev) => ({
      ...prev,
      poses: {
        ...(prev.poses || {}),
        [newKey]: "",
      },
    }));
  };

  const updatePose = (key, value) => {
    setLevel((prev) => ({
      ...prev,
      poses: {
        ...prev.poses,
        [key]: value,
      },
    }));
  };

  const removePose = (key) => {
    setLevel((prev) => {
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
    setLevel((prev) => ({
      ...prev,
      options: [...(prev.options || []), ""],
    }));
  };

  const updateOption = (index, value) => {
    setLevel((prev) => {
      const newOptions = [...prev.options];
      newOptions[index] = value;

      return {
        ...prev,
        options: newOptions,
      };
    });
  };

  const removeOption = (index) => {
    setLevel((prev) => {
      const newOptions = prev.options.filter((_, i) => i !== index);

      const newAnswers = prev.answers
        .filter((a) => a !== index)
        .map((a) => (a > index ? a - 1 : a));

      return {
        ...prev,
        options: newOptions,
        answers: newAnswers,
      };
    });
  };

  const toggleAnswer = (index) => {
    setLevel((prev) => {
      const currentAnswers = prev.answers || [];
      const exists = currentAnswers.includes(index);

      return {
        ...prev,
        answers: exists
          ? currentAnswers.filter((a) => a !== index)
          : [...currentAnswers, index],
      };
    });
  };

  /* ================= SAVE ================= */

  const handleSave = useCallback(
    async (enteredPin = "", publish = false) => {
      if (!level) return;

      setSavingLevel(true);
      setMessage("");

      try {
        let result;

        if (!level.id) {
          // CREATE
          result = await levelEditorApi.create({
            name: level.name,
            keywords: level.keywords,
            poses: level.poses,
            description: level.description,
            question: level.question,
            options: level.options,
            answers: level.answers,
            isPublished: publish,
            pin: level.pin ?? "",
          });
        } else {
          // UPDATE
          result = await levelEditorApi.save(level.id, {
            name: level.name,
            keywords: level.keywords,
            poses: level.poses,
            description: level.description,
            question: level.question,
            options: level.options,
            answers: level.answers,
            isPublished: publish,
            pin: level.pin ?? "",
          });
        }

        if (!result.success) {
          setMessage(result.message || "Failed to save level.");
          return;
        }

        if (enteredPin) {
          sessionStorage.setItem("editorPin", enteredPin);
        }

        // If newly created, redirect to edit page
        if (!level.id && result.id) {
          const newId = result.id;
          setLevel((prev) => ({ ...prev, id: newId }));
          router.replace(`/level/edit/${newId}`);
          return;
        }

        alert(publish ? "Level published!" : "Draft saved!");
      } catch (err) {
        console.error(err);
        
        // Handle PIN errors
        if (err.message.includes("PIN")) {
          const enteredPin = prompt("This level is PIN protected. Please enter the PIN:");
          if (enteredPin) {
            sessionStorage.setItem("editorPin", enteredPin);
            // Retry save with PIN
            handleSave(enteredPin, publish);
            return;
          }
        }
        
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

    try {
      const { success, message: msg } = await levelEditorApi.delete(level.id);

      if (!success) {
        alert(msg || "Failed to delete level.");
        return;
      }

      alert("Level deleted.");
      router.replace("/level/menu");
    } catch (err) {
      console.error(err);
      
      // Handle PIN errors
      if (err.message.includes("PIN")) {
        alert("You don't have permission to delete this level.");
        return;
      }
      
      alert("Unexpected error deleting level.");
    }
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