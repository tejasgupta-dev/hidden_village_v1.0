"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GameMenu() {
  const router = useRouter();

  const [games, setGames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  // PIN modal state
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch("/api/game/list", {
          method: "GET",
          credentials: "include", // important for session cookie
        });

        if (res.status === 401) {
          router.push("/auth/signIn?redirect=/game");
          return;
        }

        const data = await res.json();

        if (!res.ok || !data.success || !data.data) {
          setError("Failed to load games.");
          return;
        }

        setGames(data.data);
      } catch (err) {
        console.error("Error fetching games:", err);
        setError("Failed to load games.");
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [router]);

  // Filter games
  const filteredGames = Object.entries(games).filter(([id, g]) => {
    try {
      const reg = new RegExp(search, "i");
      return (
        reg.test(g.name || "") ||
        reg.test(g.author || "") ||
        reg.test((g.keywords || []).join(" "))
      );
    } catch {
      return true;
    }
  });

  // When clicking a game row
  const handleSelectGame = async (id) => {
    setSelectedGameId(id);

    try {
      const res = await fetch("/api/game/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id,
          pin: "",
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        sessionStorage.setItem("editorPin", "");
        router.push(`/game/edit/${id}`);
        return;
      }

      setShowPinModal(true);
    } catch (err) {
      console.error(err);
      setShowPinModal(true);
    }
  };

  const handleConfirmPin = async () => {
    if (!selectedGameId) return;

    try {
      const res = await fetch("/api/game/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: selectedGameId,
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

      router.push(`/game/edit/${selectedGameId}`);
    } catch (err) {
      console.error(err);
      alert("Unexpected error verifying PIN.");
    }
  };

  if (loading)
    return <p className="text-center text-xl py-8">Loading games...</p>;

  if (error)
    return (
      <p className="text-center text-xl py-8 text-red-500">
        ⚠️ {error}
      </p>
    );

  return (
    <div className="w-full flex flex-col items-center overflow-x-hidden relative">
      <h2 className="w-full text-center text-5xl font-semibold my-6">
        Edit Games
      </h2>

      <input
        placeholder="Search by name, author, or keyword"
        className="self-end mr-5 mb-8 w-1/4 min-w-[200px] h-10 px-4 text-lg rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {Object.keys(games).length > 0 ? (
        filteredGames.length > 0 ? (
          <div className="w-[90%] overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-3 text-lg table-fixed">
              <thead>
                <tr>
                  <th className="text-center font-semibold py-2 w-1/3">Name</th>
                  <th className="text-center font-semibold py-2 w-1/3">Author</th>
                  <th className="text-center font-semibold py-2 w-1/6">Keywords</th>
                  <th className="text-center font-semibold py-2 w-1/6">Published</th>
                </tr>
              </thead>

              <tbody>
                {filteredGames.map(([id, game]) => (
                  <tr
                    key={id}
                    onClick={() => handleSelectGame(id)}
                    className="cursor-pointer group"
                  >
                    <td className="bg-white px-4 py-3 text-center shadow rounded-l-xl truncate group-hover:bg-gray-50">
                      {game.name || "Untitled Game"}
                    </td>

                    <td className="bg-white px-4 py-3 text-center shadow truncate group-hover:bg-gray-50">
                      {game.author || "Unknown"}
                    </td>

                    <td className="bg-white px-4 py-3 text-center shadow truncate group-hover:bg-gray-50">
                      {Array.isArray(game.keywords)
                        ? game.keywords.join(", ")
                        : game.keywords || "None"}
                    </td>

                    <td
                      className={`bg-white px-4 py-3 text-center shadow rounded-r-xl truncate group-hover:bg-gray-50 ${
                        game.isPublished
                          ? "text-green-600"
                          : "text-orange-500"
                      }`}
                    >
                      {game.isPublished ? "✅" : "❌"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pt-[10vh] text-red-500 text-2xl text-center">
            No games match your search
          </p>
        )
      ) : (
        <p className="pt-[10vh] text-red-500 text-2xl text-center">
          No games found
        </p>
      )}

      {/* PIN MODAL unchanged */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-80">
            <h3 className="text-xl font-semibold mb-4 text-center">
              Enter Editor PIN
            </h3>

            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmPin();
              }}
              className="w-full border px-3 py-2 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter PIN"
              autoFocus
            />

            <div className="flex justify-between">
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setPin("");
                  setSelectedGameId(null);
                }}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition"
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
