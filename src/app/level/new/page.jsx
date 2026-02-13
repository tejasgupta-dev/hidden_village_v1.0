"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";

export default function NewLevel() {
  const router = useRouter();
  const { user } = useAuth();

  const [level, setLevel] = useState({
    name: "",
    keywords: "",
    poses: {},
    description: "",
    question: "",
    options: [],
    answers: [],
    pin: "", // optional if your API supports it
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  /* =========================
     Pose Handlers
  ========================== */
  const addPose = () => {
    const key = `pose${Date.now()}`;
    setLevel((prev) => ({
      ...prev,
      poses: { ...prev.poses, [key]: "" },
    }));
  };

  const updatePose = (key, val) => {
    setLevel((prev) => ({
      ...prev,
      poses: { ...prev.poses, [key]: val },
    }));
  };

  const removePose = (key) => {
    setLevel((prev) => {
      const copy = { ...prev.poses };
      delete copy[key];
      return { ...prev, poses: copy };
    });
  };

  /* =========================
     Options & Answers
  ========================== */
  const addOption = () => {
    setLevel((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }));
  };

  const updateOption = (i, val) => {
    setLevel((prev) => {
      const updated = [...prev.options];
      updated[i] = val;
      return { ...prev, options: updated };
    });
  };

  const removeOption = (i) => {
    setLevel((prev) => ({
      ...prev,
      options: prev.options.filter((_, idx) => idx !== i),
      answers: prev.answers.filter((ans) => ans !== i),
    }));
  };

  const toggleAnswer = (i) => {
    setLevel((prev) => ({
      ...prev,
      answers: prev.answers.includes(i)
        ? prev.answers.filter((a) => a !== i)
        : [...prev.answers, i],
    }));
  };

  /* =========================
     Save / Publish (API)
  ========================== */
  const saveLevel = async (publish) => {
    if (!user) {
      setMsg("You must be logged in.");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/level/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: null, // null = create new
          newPin: level.pin || "", // optional
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
        setMsg(data.message || "Error saving level.");
        return;
      }

      const newLevelId = data.data?.levelId;

      if (!newLevelId) {
        setMsg("Level saved but no ID returned.");
        return;
      }

      // Save PIN for editing session if used
      if (level.pin) {
        sessionStorage.setItem("editorPin", level.pin);
      }

      alert(publish ? "Level created and published!" : "Draft created!");

      router.push(`/level/edit/${newLevelId}`);

    } catch (err) {
      console.error("Create level error:", err);
      setMsg("Unexpected error creating level.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Create New Level</h1>

      {msg && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded">
          {msg}
        </div>
      )}

      <div>
        <label className="font-semibold">Author</label>
        <input
          className="w-full border p-2 rounded bg-gray-100"
          value={user?.email || ""}
          readOnly
          disabled
        />
      </div>

      <div>
        <label className="font-semibold">Name</label>
        <input
          className="w-full border p-2 rounded"
          value={level.name}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, name: e.target.value }))
          }
        />
      </div>

      <div>
        <label className="font-semibold">Keywords</label>
        <input
          className="w-full border p-2 rounded"
          value={level.keywords}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, keywords: e.target.value }))
          }
        />
      </div>

      <div>
        <label className="font-semibold">Description</label>
        <textarea
          className="w-full border p-2 rounded"
          value={level.description}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, description: e.target.value }))
          }
        />
      </div>

      {/* Optional PIN */}
      <div>
        <label className="font-semibold">PIN (optional)</label>
        <input
          className="w-full border p-2 rounded"
          value={level.pin}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, pin: e.target.value }))
          }
          placeholder="Leave empty for public level"
        />
      </div>

      {/* Poses */}
      <div className="border p-3 rounded">
        <label className="font-semibold">Poses</label>

        {Object.entries(level.poses).map(([key, val]) => (
          <div className="flex gap-2 mb-2 mt-2" key={key}>
            <input
              className="flex-1 border p-2 rounded"
              value={val}
              onChange={(e) => updatePose(key, e.target.value)}
            />
            <button
              className="px-3 py-1 bg-red-500 text-white rounded"
              onClick={() => removePose(key)}
            >
              X
            </button>
          </div>
        ))}

        <button
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
          onClick={addPose}
        >
          Add Pose
        </button>
      </div>

      <div>
        <label className="font-semibold">Question</label>
        <textarea
          className="w-full border p-2 rounded"
          value={level.question}
          onChange={(e) =>
            setLevel((prev) => ({ ...prev, question: e.target.value }))
          }
        />
      </div>

      {/* Options */}
      <div className="border p-3 rounded">
        <label className="font-semibold">Options</label>

        {level.options.map((opt, i) => (
          <div className="flex gap-2 items-center mb-2 mt-2" key={i}>
            <input
              className="flex-1 border p-2 rounded"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
            />

            <input
              type="checkbox"
              checked={level.answers.includes(i)}
              onChange={() => toggleAnswer(i)}
              className="w-4 h-4"
            />

            <button
              className="px-3 py-1 bg-red-500 text-white rounded"
              onClick={() => removeOption(i)}
            >
              X
            </button>
          </div>
        ))}

        <button
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
          onClick={addOption}
        >
          Add Option
        </button>
      </div>

      <div className="flex gap-3">
        <button
          disabled={saving}
          className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
          onClick={() => saveLevel(false)}
        >
          Save Draft
        </button>

        <button
          disabled={saving}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          onClick={() => saveLevel(true)}
        >
          Publish
        </button>
      </div>
    </div>
  );
}
