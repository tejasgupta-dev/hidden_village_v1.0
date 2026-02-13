"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LevelMenu({ mode }) {
  const router = useRouter();
  const playMode = mode === "play";

  const [levels, setLevels] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const [selectedLevelId, setSelectedLevelId] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");

  /* ---------------- FETCH LEVELS ---------------- */
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const res = await fetch("/api/level/list", {
          method: "GET",
          credentials: "include",
        });

        if (res.status === 401) {
          router.push("/auth/signIn?redirect=/level");
          return;
        }

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "Failed to load levels.");
          return;
        }

        let fetched = data.data || {};

        if (playMode) {
          fetched = Object.fromEntries(
            Object.entries(fetched).filter(([_, lvl]) => lvl.isPublished)
          );
        }

        setLevels(fetched);
      } catch (err) {
        console.error(err);
        setError("Failed to load levels.");
      } finally {
        setLoading(false);
      }
    };

    fetchLevels();
  }, [playMode, router]);

  /* ---------------- SEARCH FILTER ---------------- */
  const filteredLevels = Object.entries(levels).filter(([_, lvl]) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (lvl.name || "").toLowerCase().includes(s) ||
      (lvl.author || "").toLowerCase().includes(s) ||
      (Array.isArray(lvl.keywords)
        ? lvl.keywords.join(" ")
        : lvl.keywords || ""
      )
        .toLowerCase()
        .includes(s)
    );
  });

  /* ---------------- SELECT LEVEL ---------------- */
  const handleSelectLevel = async (id) => {
    setSelectedLevelId(id);

    if (playMode) {
      router.push(`/level/play/${id}`);
      return;
    }

    try {
      const res = await fetch("/api/level/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, pin: "" }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        sessionStorage.setItem("editorPin", "");
        router.push(`/level/edit/${id}`);
        return;
      }

      setShowPinModal(true);
    } catch (err) {
      console.error(err);
      setShowPinModal(true);
    }
  };

  /* ---------------- CONFIRM PIN ---------------- */
  const handleConfirmPin = async () => {
    if (!selectedLevelId) return;

    try {
      const res = await fetch("/api/level/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: selectedLevelId,
          pin: pin.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Invalid PIN.");
        return;
      }

      sessionStorage.setItem("editorPin", pin.trim());
      setShowPinModal(false);
      setPin("");
      router.push(`/level/edit/${selectedLevelId}`);
    } catch (err) {
      console.error(err);
      alert("Unexpected error verifying PIN.");
    }
  };

  /* ---------------- RENDER ---------------- */
  if (loading)
    return <p className="text-center text-xl py-8 text-black">Loading levels...</p>;

  if (error)
    return (
      <p className="text-center text-xl py-8 text-black">
        ⚠️ {error}
      </p>
    );

  return (
    <div className="w-full flex flex-col items-center overflow-x-hidden relative">
      <h2 className="w-full text-center text-5xl font-semibold my-6 text-black">
        {playMode ? "Play Levels" : "Edit Levels"}
      </h2>

      <input
        placeholder="Search by name, author, or keyword"
        className="self-end mr-5 mb-8 w-1/4 min-w-[200px] h-10 px-4 text-lg text-black placeholder-gray-500 rounded-full border border-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {Object.keys(levels).length > 0 ? (
        filteredLevels.length > 0 ? (
          <div className="w-[90%] overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-3 text-lg table-fixed">
              <thead>
                <tr className="text-black">
                  <th className="w-1/3">Name</th>
                  <th className="w-1/3">Author</th>
                  <th className="w-1/6">Keywords</th>
                  {!playMode && <th className="w-1/6">Published</th>}
                </tr>
              </thead>

              <tbody>
                {filteredLevels.map(([id, lvl]) => (
                  <tr
                    key={id}
                    onClick={() => handleSelectLevel(id)}
                    className="cursor-pointer group"
                  >
                    <td className="bg-white px-4 py-3 text-center text-black shadow rounded-l-xl truncate group-hover:bg-gray-100">
                      {lvl.name || "Untitled Level"}
                    </td>

                    <td className="bg-white px-4 py-3 text-center text-black shadow truncate group-hover:bg-gray-100">
                      {lvl.author || "Unknown"}
                    </td>

                    <td className="bg-white px-4 py-3 text-center text-black shadow truncate group-hover:bg-gray-100">
                      {Array.isArray(lvl.keywords)
                        ? lvl.keywords.join(", ")
                        : lvl.keywords || "None"}
                    </td>

                    {!playMode && (
                      <td className="bg-white px-4 py-3 text-center shadow rounded-r-xl truncate group-hover:bg-gray-100">
                        <span className={lvl.isPublished ? "text-green-600" : "text-orange-500"}>
                          {lvl.isPublished ? "✅" : "❌"}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pt-[10vh] text-black text-2xl text-center">
            No levels match your search
          </p>
        )
      ) : (
        <p className="pt-[10vh] text-black text-2xl text-center">
          {playMode ? "No published levels available" : "No levels found"}
        </p>
      )}

      {/* PIN MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-80">
            <h3 className="text-xl font-semibold mb-4 text-center text-black">
              Enter Editor PIN
            </h3>

            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmPin()}
              className="w-full border border-gray-400 px-3 py-2 rounded-lg mb-4 text-black placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter PIN"
              autoFocus
            />

            <div className="flex justify-between">
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setPin("");
                  setSelectedLevelId(null);
                }}
                className="px-4 py-2 rounded-lg bg-gray-200 text-black hover:bg-gray-300 transition"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmPin}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}