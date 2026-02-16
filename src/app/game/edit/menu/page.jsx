"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

function GameMenu({ mode }) {
  const router = useRouter();

  const playMode = mode === "play";
  const editMode = mode === "edit";

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
        });

        const data = await res.json();

        if (!mounted) return;

        if (!data.success || !Array.isArray(data.games)) {
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
    return () => (mounted = false);
  }, [playMode]);

  /* =========================================
     SEARCH
  ========================================= */
  const filteredGames = useMemo(() => {
    if (!Array.isArray(games)) return [];

    try {
      const reg = new RegExp(search, "i");
      return games.filter(
        (g) =>
          reg.test(g.name || "") ||
          reg.test(g.author || "") ||
          reg.test(g.keywords || "")
      );
    } catch {
      return games;
    }
  }, [games, search]);

  /* =========================================
     NAVIGATION
  ========================================= */
  const navigateToGame = (id, verifiedPin = null) => {
    if (!id) return;

    if (verifiedPin) {
      sessionStorage.setItem(`game_pin_${id}`, verifiedPin);
    }

    if (playMode) {
      router.push(`/game/${id}`);
    } else {
      router.push(`/game/edit/${id}`);
    }
  };

  /* =========================================
     SELECT GAME
  ========================================= */
  const handleSelectGame = async (id) => {
    try {
      const res = await fetch(`/api/games/${id}`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "Failed to load game.");
        return;
      }

      if (data.hasPin) {
        setSelectedGameId(id);
        setShowPinModal(true);
        setPin("");
        setPinError("");
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
        headers: {
          "x-game-pin": pin,
        },
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setShowPinModal(false);
        navigateToGame(selectedGameId, pin);
      } else {
        setPinError("Incorrect PIN");
      }
    } catch (err) {
      setPinError("Error verifying PIN");
    } finally {
      setPinLoading(false);
    }
  };

  const closePinModal = () => {
    setShowPinModal(false);
    setSelectedGameId(null);
    setPin("");
    setPinError("");
  };

  /* =========================================
     RENDER
  ========================================= */

  if (loading)
    return <p className="text-center text-gray-600">Loading games...</p>;

  if (error)
    return <p className="text-center text-red-600">⚠️ {error}</p>;

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">
          {playMode ? "Play Games" : "Edit Games"}
        </h2>

        <input
          placeholder="Search by name, author, or keyword"
          className="w-full px-4 py-2 mb-6 border rounded-lg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {filteredGames.length === 0 ? (
          <p className="text-center text-gray-600 py-8">
            {playMode
              ? "No published games available"
              : "No games found"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Keywords
                  </th>
                  {!playMode && (
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Status
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredGames.map((game) => (
                  <tr
                    key={game.id}
                    onClick={() => handleSelectGame(game.id)}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      {game.name || "Untitled Game"}
                      {game.hasPin && (
                        <span className="ml-2 text-yellow-600">🔒</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {game.author || "Unknown"}
                    </td>

                    <td className="px-6 py-4">
                      {game.keywords || "None"}
                    </td>

                    {!playMode && (
                      <td className="px-6 py-4">
                        <span
                          className={
                            game.isPublished
                              ? "text-green-600"
                              : "text-orange-600"
                          }
                        >
                          {game.isPublished
                            ? "✅ Published"
                            : "❌ Draft"}
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

      {/* PIN MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">
              Protected Game
            </h3>

            <form onSubmit={handlePinSubmit}>
              <input
                type="password"
                placeholder="Enter PIN"
                className="w-full px-4 py-2 border rounded mb-4"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
              />

              {pinError && (
                <p className="text-red-600 text-sm mb-4">
                  {pinError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closePinModal}
                  className="flex-1 border rounded py-2"
                  disabled={pinLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white rounded py-2"
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

export default GameMenu;
