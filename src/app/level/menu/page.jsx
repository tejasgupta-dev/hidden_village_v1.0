"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  levelMenuApi,
  searchLevels,
  filterLevelsByStatus,
  isLevelProtected,
} from "@/lib/api/levelMenuApi";

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

  // fetch levels
  useEffect(() => {
    let mounted = true;

    const fetchLevels = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await levelMenuApi.list();

        if (!mounted) return;

        if (!res?.success || !Array.isArray(res.levels)) {
          setLevels([]);
          return;
        }

        // play = only published
        // edit = all levels
        const filtered = playMode
          ? filterLevelsByStatus(res.levels, true)
          : res.levels;

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

    router.push(`/level/${levelId}`);
  };

  // Click level → check if protected, then navigate
  const handleSelectLevel = async (levelId) => {
    if (!levelId) {
      console.error("handleSelectLevel: No level ID provided");
      return;
    }

    console.log("Selecting level with ID:", levelId);

    try {
      const res = await levelMenuApi.getPreview(levelId);

      if (!res.success) {
        alert("Failed to load level");
        return;
      }

      if (res.hasPin) {
        setSelectedLevelId(levelId);
        setShowPinModal(true);
        setPin("");
        setPinError("");
        return;
      }

      // No pin required
      navigateToLevel(levelId);

    } catch (err) {
      console.error("Error in handleSelectLevel:", err);
      alert("Error loading level: " + (err.message || "Unknown error"));
    }
  };

  // Handle PIN submission
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    
    if (!pin.trim()) {
      setPinError("Please enter a PIN");
      return;
    }

    setPinLoading(true);
    setPinError("");

    try {
      // Verify PIN by getting level preview with PIN header
      const res = await levelMenuApi.getPreview(selectedLevelId, { pin });

      if (res.success) {
        // PIN correct, close modal and navigate with verified PIN
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
  if (loading)
    return <p className="text-center text-gray-600">Loading levels...</p>;

  if (error) return <p className="text-center text-red-600">⚠️ {error}</p>;

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">
          {playMode ? "Play Levels" : "Edit Levels"}
        </h2>

        <input
          placeholder="Search by name, author, or keyword"
          className="w-full px-4 py-2 mb-6 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {levels.length === 0 ? (
          <p className="text-center text-gray-600 py-8">
            {playMode ? "No published levels available" : "No levels found"}
          </p>
        ) : filteredLevels.length === 0 ? (
          <p className="text-center text-gray-600 py-8">
            No levels match your search
          </p>
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
                {filteredLevels.map((lvl) => {
                  // Debug: log the level object to see its structure
                  console.log("Level object:", lvl);
                  
                  return (
                    <tr
                      key={lvl.id}
                      onClick={() => handleSelectLevel(lvl.id)}
                      className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">
                        {lvl.name || "Untitled Level"}
                        {isLevelProtected(lvl) && (
                          <span className="ml-2 text-yellow-600">🔒</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                        {lvl.author || "Unknown"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                        {Array.isArray(lvl.keywords)
                          ? lvl.keywords.join(", ")
                          : lvl.keywords || "None"}
                      </td>

                      {!playMode && (
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={
                              lvl.isPublished
                                ? "text-green-600"
                                : "text-orange-600"
                            }
                          >
                            {lvl.isPublished ? "✅ Published" : "❌ Draft"}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Protected Level</h3>
            <p className="text-gray-600 mb-4">
              This level is protected. Please enter the PIN to access it.
            </p>

            <form onSubmit={handlePinSubmit}>
              <input
                type="password"
                placeholder="Enter PIN"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
              />

              {pinError && (
                <p className="text-red-600 text-sm mb-4">{pinError}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closePinModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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