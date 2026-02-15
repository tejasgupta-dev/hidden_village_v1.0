"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

export default function GameMenu() {
  const router = useRouter();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const handleBack = () => router.back();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch("/api/games", {
          method: "GET",
          credentials: "include",
        });

        if (res.status === 401) {
          router.push("/auth/signIn?redirect=/game");
          return;
        }

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "Failed to load games.");
          return;
        }

        setGames(data.games || []);
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
  const filteredGames = games.filter((game) => {
    try {
      const reg = new RegExp(search, "i");
      return (
        reg.test(game.name || "") ||
        reg.test(game.author || "") ||
        reg.test(game.keywords || "")
      );
    } catch {
      return true;
    }
  });

  // Navigate to edit page
  const handleSelectGame = (id) => {
    router.push(`/game/edit/${id}`);
  };

  // Create new game
  const handleCreateNew = () => {
    router.push("/game/create");
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-900 text-sm">Loading games...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <p className="text-center text-xl py-8 text-red-600">
        ⚠️ {error}
      </p>
    );

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
          Edit Games
        </h2>

        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
        >
          <Plus size={18} /> New Game
        </button>
      </div>

      <input
        placeholder="Search by name, author, or keyword"
        className="self-end mr-5 mb-8 w-1/4 min-w-[200px] h-10 px-4 text-lg text-gray-900 placeholder-gray-500 rounded-full border border-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {games.length > 0 ? (
        filteredGames.length > 0 ? (
          <div className="w-[90%] overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-3 text-lg table-fixed">
              <thead>
                <tr className="text-gray-900">
                  <th className="w-1/3">Name</th>
                  <th className="w-1/3">Author</th>
                  <th className="w-1/6">Keywords</th>
                  <th className="w-1/6">Published</th>
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

                    <td className="bg-white px-4 py-3 text-center text-gray-900 shadow truncate group-hover:bg-gray-100">
                      {game.author || "Unknown"}
                    </td>

                    <td className="bg-white px-4 py-3 text-center text-gray-900 shadow truncate group-hover:bg-gray-100">
                      {game.keywords || "None"}
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
          <p className="pt-[10vh] text-gray-900 text-2xl text-center">
            No games match your search
          </p>
        )
      ) : (
        <div className="pt-[10vh] text-center">
          <p className="text-gray-900 text-2xl mb-4">No games found</p>
          <button
            onClick={handleCreateNew}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Create Your First Game
          </button>
        </div>
      )}
    </div>
  );
}