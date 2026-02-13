"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Plus, Trash2 } from "lucide-react";

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
    pin: "",
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
          id: null,
          newPin: level.pin || "",
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
    <div className="min-h-screen bg-transparent py-4 px-3">
      <div className="max-w-3xl mx-auto">
        
        {/* HEADER */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">
          Create Level
        </h1>
        <p className="text-sm text-gray-600 text-center mb-4">
          {user?.email || ""}
        </p>

        {msg && (
          <div className="mb-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm text-center font-medium">
            {msg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          
          {/* LEFT COLUMN */}
          <div className="space-y-3">
            
            {/* BASIC INFO */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Basic Info</h2>
              
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Name *</label>
                  <input
                    value={level.name}
                    onChange={(e) => setLevel((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-400 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Level name..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Keywords</label>
                  <input
                    value={level.keywords}
                    onChange={(e) => setLevel((prev) => ({ ...prev, keywords: e.target.value }))}
                    className="w-full border border-gray-400 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="yoga, balance..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={level.description}
                    onChange={(e) => setLevel((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full border border-gray-400 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Brief description..."
                  />
                </div>
              </div>
            </div>

            {/* PIN */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">PIN</h2>
              <input
                value={level.pin}
                onChange={(e) => setLevel((prev) => ({ ...prev, pin: e.target.value }))}
                className="w-full border border-gray-400 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter PIN..."
              />
            </div>

            {/* POSES */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">Poses</h2>

              <div className="space-y-2 max-h-32 overflow-y-auto">
                {Object.entries(level.poses || {}).map(([key, val]) => (
                  <div className="flex gap-2 items-center" key={key}>
                    <input
                      value={val}
                      onChange={(e) => updatePose(key, e.target.value)}
                      className="flex-1 border border-gray-400 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Pose..."
                    />
                    <button
                      className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-600 hover:text-white"
                      onClick={() => removePose(key)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1.5"
                onClick={addPose}
              >
                <Plus size={14} />
                Add Pose
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-3">
            
            {/* QUESTION */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">Question</h2>
              <textarea
                rows={3}
                value={level.question}
                onChange={(e) => setLevel((prev) => ({ ...prev, question: e.target.value }))}
                className="w-full border border-gray-400 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Your question..."
              />
            </div>

            {/* OPTIONS */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">Options</h2>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {level.options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      className="flex-1 border border-gray-400 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Option ${i + 1}...`}
                    />
                    <input
                      type="checkbox"
                      checked={level.answers.includes(i)}
                      onChange={() => toggleAnswer(i)}
                      className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-2 focus:ring-blue-500"
                      title={level.answers.includes(i) ? "Correct" : "Incorrect"}
                    />
                    <button
                      className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-600 hover:text-white"
                      onClick={() => removeOption(i)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1.5"
                onClick={addOption}
              >
                <Plus size={14} />
                Add Option
              </button>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="mt-3 bg-white rounded-lg border border-gray-300 p-3">
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              disabled={saving}
              className="px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => saveLevel(false)}
            >
              Save Draft
            </button>

            <button
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => saveLevel(true)}
            >
              Publish
            </button>

            <button
              className="px-4 py-2 bg-white border border-gray-400 text-gray-900 text-sm font-semibold rounded hover:bg-gray-50"
              onClick={() => router.back()}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}