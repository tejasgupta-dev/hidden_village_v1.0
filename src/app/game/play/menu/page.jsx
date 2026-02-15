"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PlayGameMenu() {
  const router = useRouter();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const handleBack = () => router.back();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        // Fetch public games (no auth required)
        const res = await fetch("/api/games?mode=public", {
          method: "GET",
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "Failed to load games.");
          return;
        }

        // Games are already filtered for published on the backend
        setGames(data.games || []);
      } catch (err) {
        console.error("Error fetching games:", err);
        setError("Failed to load games.");
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  // Filter games by search
  const filteredGames = games.filter((game) => {
    try {
      const reg = new RegExp(search, "i");
      return (
        reg.test(game.name || "") ||
        reg.test(game.keywords || "")
      );
    } catch {
      return true;
    }
  });

  const handleSelectGame = (id) => {
    router.push(`/game/play/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-900 text-sm">Loading games...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-center text-xl text-red-600">⚠️ {error}</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full flex justify-between items-center px-5 my-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            <ArrowLeft size={18} /> Back
          </button>

          <h2 className="text-5xl font-semibold text-gray-900 flex-1 text-center">
            Play Games
          </h2>

          <div className="w-20"></div>
        </div>

        <p className="pt-[10vh] text-gray-900 text-2xl text-center">
          No published games available
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center overflow-x-hidden relative min-h-screen bg-gray-50">
      <div className="w-full flex justify-between items-center px-5 my-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
        >
          <ArrowLeft size={18} /> Back
        </button>

        <h2 className="text-5xl font-semibold text-gray-900 flex-1 text-center">
          Play Games
        </h2>

        <div className="w-20"></div>
      </div>

      <input
        placeholder="Search by name or keyword"
        className="self-end mr-5 mb-8 w-1/4 min-w-[200px] h-10 px-4 text-lg text-gray-900 placeholder-gray-500 rounded-full border border-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredGames.length > 0 ? (
        <div className="w-[90%] overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-3 text-lg table-fixed">
            <thead>
              <tr className="text-gray-900">
                <th className="text-center font-semibold py-2 w-1/2">Name</th>
                <th className="text-center font-semibold py-2 w-1/2">Keywords</th>
              </tr>
            </thead>

            <tbody>
              {filteredGames.map((game) => (
                <tr
                  key={game.id}
                  onClick={() => handleSelectGame(game.id)}
                  className="cursor-pointer group"
                >
                  <td className="bg-white px-4 py-3 text-center text-gray-900 shadow rounded-l-xl truncate group-hover:bg-gray-100">
                    {game.name || "Untitled Game"}
                  </td>

                  <td className="bg-white px-4 py-3 text-center text-gray-900 shadow rounded-r-xl truncate group-hover:bg-gray-100">
                    {game.keywords || "None"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="pt-[10vh] text-gray-900 text-2xl text-center">
          No games match your search
        </p>
      )}
    </div>
  );
}