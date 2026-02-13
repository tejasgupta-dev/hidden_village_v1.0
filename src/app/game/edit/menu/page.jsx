"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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

  const handleBack = () => router.back();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch("/api/game/list", {
          method: "GET",
          credentials: "include",
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
    return <p className="text-center text-xl py-8 text-black">Loading games...</p>;

  if (error)
    return (
      <p className="text-center text-xl py-8 text-black">
        ⚠️ {error}
      </p>
    );

  return (
    <div className="w-full flex flex-col items-center overflow-x-hidden relative">
      <div className="w-full flex justify-between items-center px-5 my-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
        >
          <ArrowLeft size={18} /> Back
        </button>

        <h2 className="text-5xl font-semibold text-black flex-1 text-center">
          Edit Games
        </h2>

        <div className="w-20"></div>
      </div>

      <input
        placeholder="Search by name, author, or keyword"
        className="self-end mr-5 mb-8 w-1/4 min-w-[200px] h-10 px-4 text-lg text-black placeholder-gray-500 rounded-full border border-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {Object.keys(games).length > 0 ? (
        filteredGames.length > 0 ? (
          <div className="w-[90%] overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-3 text-lg table-fixed">
              <thead>
                <tr className="text-black">
                  <th className="w-1/3">Name</th>
                  <th className="w-1/3">Author</th>
                  <th className="w-1/6">Keywords</th>
                  <th className="w-1/6">Published</th>
                </tr>
              </thead>

              <tbody>
                {filteredGames.map(([id, game]) => (
                  <tr
                    key={id}
                    onClick={() => handleSelectGame(id)}
                    className="cursor-pointer group"
                  >
                    <td className="bg-white px-4 py-3 text-center text-black shadow rounded-l-xl truncate group-hover:bg-gray-100">
                      {game.name || "Untitled Game"}
                    </td>

                    <td className="bg-white px-4 py-3 text-center text-black shadow truncate group-hover:bg-gray-100">
                      {game.author || "Unknown"}
                    </td>

                    <td className="bg-white px-4 py-3 text-center text-black shadow truncate group-hover:bg-gray-100">
                      {Array.isArray(game.keywords)
                        ? game.keywords.join(", ")
                        : game.keywords || "None"}
                    </td>

                    <td className="bg-white px-4 py-3 text-center shadow rounded-r-xl truncate group-hover:bg-gray-100">
                      <span className={game.isPublished ? "text-green-600" : "text-orange-500"}>
                        {game.isPublished ? "✅" : "❌"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pt-[10vh] text-black text-2xl text-center">
            No games match your search
          </p>
        )
      ) : (
        <p className="pt-[10vh] text-black text-2xl text-center">
          No games found
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
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmPin();
              }}
              className="w-full border border-gray-400 px-3 py-2 rounded-lg mb-4 text-black placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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