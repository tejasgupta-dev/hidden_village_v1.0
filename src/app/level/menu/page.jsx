"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  levelMenu,
  searchLevels,
  filterByStatus,
  isProtected,
} from "@/lib/domain/levels/levelMenu";

function LevelMenu({ mode }) {
  const router = useRouter();

  const playMode = mode === "play";
  const editMode = mode === "edit";

  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");

  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  // ✅ Force readable inputs (avoid inheriting gray from parents/global styles)
  const inputClass =
    "w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 " +
    "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 " +
    "disabled:bg-gray-100 disabled:text-gray-700 disabled:cursor-not-allowed !text-gray-900";

  // fetch levels
  useEffect(() => {
    let mounted = true;

    const fetchLevels = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await levelMenu.list();
        if (!mounted) return;

        if (!res?.success || !Array.isArray(res.levels)) {
          setLevels([]);
          return;
        }

        // play = only published
        // edit = all levels
        const filtered = playMode ? filterByStatus(res.levels, true) : res.levels;
        setLevels(filtered || []);
      } catch (err) {
        console.error("Error fetching levels:", err);
        if (mounted) {
          setError("Failed to load levels.");
          setLevels([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLevels();
    return () => {
      mounted = false;
    };
  }, [playMode]);

  // Memoize and ensure array
  const filteredLevels = useMemo(() => {
    if (!Array.isArray(levels)) return [];
    return searchLevels(levels, search || "");
  }, [levels, search]);

  // Navigate to level
  const navigateToLevel = (levelId, verifiedPin = null) => {
    if (!levelId) {
      console.error("navigateToLevel: No level ID provided");
      return;
    }

    // Store PIN for level page
    if (verifiedPin) {
      sessionStorage.setItem(`level_pin_${levelId}`, verifiedPin);
    }

    const path = editMode ? `/level/edit/${levelId}` : `/level/${levelId}`;
    router.push(path);
  };

  // Click level → check if protected, then navigate
  const handleSelectLevel = async (levelId) => {
    try {
      const res = await fetch(`/api/levels/${levelId}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));

      // If API indicates preview/locked, show modal
      if (res.status === 403 || data?.preview === true) {
        setSelectedLevelId(levelId);
        setShowPinModal(true);
        setPin("");
        setPinError("");
        return;
      }

      if (!data?.success) {
        alert(data?.message || "Failed to load level.");
        return;
      }

      navigateToLevel(levelId);
    } catch (err) {
      console.error(err);
      alert("Error loading level.");
    }
  };

  // Handle PIN submission
  const handlePinSubmit = async (e) => {
    e.preventDefault();

    if (!pin.trim()) {
      setPinError("Please enter a PIN");
      return;
    }

    if (!selectedLevelId) {
      setPinError("No level selected.");
      return;
    }

    setPinLoading(true);
    setPinError("");

    try {
      // Verify PIN by getting level preview with PIN header
      const res = await levelMenu.getPreview(selectedLevelId, { pin });

      if (res?.success) {
        setShowPinModal(false);
        navigateToLevel(selectedLevelId, pin);
      } else {
        setPinError("Incorrect PIN");
      }
    } catch (err) {
      console.error("PIN verification error:", err);
      setPinError("Incorrect PIN or error verifying");
    } finally {
      setPinLoading(false);
    }
  };

  const closePinModal = () => {
    setShowPinModal(false);
    setSelectedLevelId(null);
    setPin("");
    setPinError("");
  };

  // render UI
  if (loading) return <p className="text-center text-gray-600">Loading levels...</p>;
  if (error) return <p className="text-center text-red-600">⚠️ {error}</p>;

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6 text-gray-900">
          {playMode ? "Play Levels" : "Edit Levels"}
        </h2>

        <input
          placeholder="Search by name, author, or keyword"
          className={`${inputClass} mb-6`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {levels.length === 0 ? (
          <p className="text-center text-gray-600 py-8">
            {playMode ? "No published levels available" : "No levels found"}
          </p>
        ) : filteredLevels.length === 0 ? (
          <p className="text-center text-gray-600 py-8">No levels match your search</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Keywords
                  </th>
                  {!playMode && (
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredLevels.map((lvl) => (
                  <tr
                    key={lvl.id}
                    onClick={() => handleSelectLevel(lvl.id)}
                    className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">
                      {lvl.name || "Untitled Level"}
                      {isProtected(lvl) && (
                        <span className="ml-2 text-yellow-600" title="Protected level">
                          🔒
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-700 truncate max-w-xs">
                      {lvl.author || "Unknown"}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-700 truncate max-w-xs">
                      {Array.isArray(lvl.keywords)
                        ? lvl.keywords.join(", ")
                        : lvl.keywords || "None"}
                    </td>

                    {!playMode && (
                      <td className="px-6 py-4 text-sm">
                        <span className={lvl.isPublished ? "text-green-600" : "text-orange-600"}>
                          {lvl.isPublished ? "✅ Published" : "❌ Draft"}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-2 text-gray-900">Protected Level</h3>
            <p className="text-gray-700 mb-4">
              This level is protected. Please enter the PIN to access it.
            </p>

            <form onSubmit={handlePinSubmit}>
              <input
                type="password"
                placeholder="Enter PIN"
                className={`${inputClass} mb-4`}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
              />

              {pinError && <p className="text-red-600 text-sm mb-4">{pinError}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closePinModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-900"
                  disabled={pinLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={pinLoading}
                >
                  {pinLoading ? "Verifying..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default LevelMenu;
