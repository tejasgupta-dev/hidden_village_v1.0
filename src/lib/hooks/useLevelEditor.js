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
      const savedPin =
        typeof window !== "undefined"
          ? sessionStorage.getItem("editorPin")
          : null;

      const options = savedPin ? { pin: savedPin } : {};

      const result = await levelEditorApi.load(id, options);

      if (!result.success) {
        if (
          result.code === "PIN_REQUIRED" ||
          result.code === "INVALID_PIN"
        ) {
          const enteredPin = prompt(
            "This level is PIN protected. Enter PIN:"
          );

          if (enteredPin) {
            sessionStorage.setItem("editorPin", enteredPin);
            loadLevel(id);
            return;
          }
        }

        alert(result.message || "Failed to load level.");
        router.replace("/level/menu");
        return;
      }

      if (result.preview) {
        const enteredPin = prompt(
          "This level is PIN protected. Enter PIN:"
        );

        if (enteredPin) {
          sessionStorage.setItem("editorPin", enteredPin);
          loadLevel(id);
          return;
        }

        router.replace("/level/menu");
        return;
      }

      setLevel({ ...result.level, id });
    } catch (err) {
      console.error(err);
      alert("Unexpected error loading level.");
      router.replace("/level/menu");
    } finally {
      setLoadingLevel(false);
    }
  };

  /* ================= SAVE ================= */

  const handleSave = useCallback(
    async (publish = false) => {
      if (!level) return;

      setSavingLevel(true);
      setMessage("");

      try {
        let result;

        if (!level.id) {
          result = await levelEditorApi.create({
            ...level,
            isPublished: publish,
          });
        } else {
          result = await levelEditorApi.save(level.id, {
            ...level,
            isPublished: publish,
          });
        }

        if (!result.success) {
          if (
            result.code === "PIN_REQUIRED" ||
            result.code === "INVALID_PIN"
          ) {
            const enteredPin = prompt(
              "This level requires a PIN. Enter PIN:"
            );

            if (enteredPin) {
              sessionStorage.setItem("editorPin", enteredPin);
              handleSave(publish);
              return;
            }
          }

          setMessage(result.message || "Failed to save.");
          return;
        }

        if (!level.id && result.id) {
          router.replace(`/level/edit/${result.id}`);
          return;
        }

        alert(publish ? "Level published!" : "Draft saved!");
      } catch (err) {
        console.error(err);
        setMessage("Unexpected error saving.");
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
      const result = await levelEditorApi.delete(level.id);

      if (!result.success) {
        alert(result.message || "Failed to delete.");
        return;
      }

      alert("Level deleted.");
      router.replace("/level/menu");
    } catch (err) {
      console.error(err);
      alert("Unexpected error deleting.");
    }
  };

  const handleBack = () => router.back();

  return {
    level,
    setLevel,
    loadingLevel,
    savingLevel,
    message,
    handleSave,
    handleDelete,
    handleBack,
  };
};
