"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

function EditGameMenu({ mode }) {
  const router = useRouter();

  const playMode = mode === "play";
  const editMode = mode === "edit"; // (kept in case you use it later)

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  // PIN modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  const inputClass =
    "w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 " +
    "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-gray-900";

  /* =========================================
     FETCH GAMES
  ========================================= */
  useEffect(() => {
    let mounted = true;

    const fetchGames = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/games", {
          credentials: "include",
          cache: "no-store",
        });

        const data = await res.json();
        if (!mounted) return;

        if (!data?.success || !Array.isArray(data.games)) {
          setGames([]);
          return;
        }

        const filtered = playMode
          ? data.games.filter((g) => g.isPublished)
          : data.games;

        setGames(filtered || []);
      } catch (err) {
        console.error(err);
        if (mounted) setError("Failed to load games.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchGames();
    return () => {
      mounted = false;
    };
  }, [playMode]);

  /* =========================================
     SEARCH
  ========================================= */
  const filteredGames = useMemo(() => {
    if (!Array.isArray(games)) return [];

    const q = (search || "").trim();
    if (!q) return games;

    try {
      const reg = new RegExp(q, "i");
      return games.filter(
        (g) =>
          reg.test(g?.name || "") ||
          reg.test(g?.author || "") ||
          reg.test(g?.keywords || "")
      );
    } catch {
      // invalid regex char like "[" -> fallback to substring matching
      const lower = q.toLowerCase();
      return games.filter((g) => {
        const name = (g?.name || "").toLowerCase();
        const author = (g?.author || "").toLowerCase();
        const keywords = (g?.keywords || "").toLowerCase();
        return name.includes(lower) || author.includes(lower) || keywords.includes(lower);
      });
    }
  }, [games, search]);

  /* =========================================
     NAVIGATION
  ========================================= */
  const navigateToGame = useCallback(
    (id, verifiedPin = null) => {
      if (!id) return;

      if (verifiedPin) {
        sessionStorage.setItem(`game_pin_${id}`, verifiedPin);
      }

      if (playMode) router.push(`/game/${id}`);
      else router.push(`/game/edit/${id}`);
    },
    [playMode, router]
  );

  /* =========================================
     PIN MODAL OPEN/CLOSE
  ========================================= */
  const openPinModal = useCallback((id) => {
    setSelectedGameId(id);
    setShowPinModal(true);
    setPin("");
    setPinError("");
  }, []);

  const closePinModal = useCallback(() => {
    setShowPinModal(false);
    setSelectedGameId(null);
    setPin("");
    setPinError("");
    setPinLoading(false);
  }, []);

  /* =========================================
     SELECT GAME
     IMPORTANT: Do NOT use `hasPin` to decide modal.
     Only use `preview:true` or `code:PIN_REQUIRED`.
  ========================================= */
  const handleSelectGame = async (id) => {
    try {
      const res = await fetch(`/api/games/${id}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json();

      // ✅ PIN gating signals ONLY
      const pinGate =
        data?.preview === true ||
        (res.status === 403 && data?.code === "PIN_REQUIRED");

      if (pinGate) {
        openPinModal(id);
        return;
      }

      if (!res.ok || !data?.success) {
        alert(data?.message || "Failed to load game.");
        return;
      }

      navigateToGame(id);
    } catch (err) {
      console.error(err);
      alert("Error loading game.");
    }
  };

  /* =========================================
     PIN SUBMIT
  ========================================= */
  const handlePinSubmit = async (e) => {
    e.preventDefault();

    if (!pin.trim()) {
      setPinError("Please enter PIN");
      return;
    }

    setPinLoading(true);
    setPinError("");

    try {
      const res = await fetch(`/api/games/${selectedGameId}`, {
        headers: { "x-game-pin": pin },
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json();

      if (data?.success) {
        setShowPinModal(false);
        navigateToGame(selectedGameId, pin);
      } else {
        setPinError(data?.message || "Incorrect PIN");
      }
    } catch (err) {
      console.error(err);
      setPinError("Error verifying PIN");
    } finally {
      setPinLoading(false);
    }
  };

  /* =========================================
     RENDER
  ========================================= */
  if (loading) {
    return <p className="text-center text-gray-600 py-10">Loading games...</p>;
  }
  if (error) {
    return <p className="text-center text-red-600 py-10">⚠️ {error}</p>;
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {playMode ? "Play Games" : "Edit Games"}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {playMode
              ? "Choose a published game to start playing."
              : "Select a game to edit its details and levels."}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <input
            placeholder="Search by name, author, or keyword"
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {filteredGames.length === 0 ? (
            <div className="text-center text-gray-600 py-12">
              {playMode ? "No published games available" : "No games found"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
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
                  {filteredGames.map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => handleSelectGame(g.id)}
                      className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-[340px] truncate">
                        {g.name || "Untitled Game"}
                        {g.hasPin && (
                          <span className="ml-2 text-yellow-600" title="PIN protected">
                            🔒
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-700 max-w-[220px] truncate">
                        {g.author || "Unknown"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-700 max-w-[340px] truncate">
                        {g.keywords || "None"}
                      </td>

                      {!playMode && (
                        <td className="px-6 py-4 text-sm">
                          <span className={g.isPublished ? "text-green-600" : "text-orange-600"}>
                            {g.isPublished ? "✅ Published" : "❌ Draft"}
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
      </div>

      {/* PIN MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Protected Game</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Enter the PIN to access this game.
                </p>
              </div>

              <button
                type="button"
                onClick={closePinModal}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="Enter PIN"
                className={inputClass}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
              />

              {pinError ? (
                <p className="text-red-600 text-sm">{pinError}</p>
              ) : null}

              <div className="flex gap-3 pt-1">
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

export default EditGameMenu;
