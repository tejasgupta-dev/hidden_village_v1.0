"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getGamesList } from "@/lib/firebase/db";

export default function PlayGameMenu() {
  const router = useRouter();

  const [games, setGames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await getGamesList();

        if (!res.success || !res.data) {
          setError("Failed to load games.");
          return;
        }

        // only published games for play mode
        const published = Object.fromEntries(
          Object.entries(res.data).filter(([_, g]) => g.isPublished)
        );

        setGames(published);
      } catch (err) {
        console.error("Error fetching games:", err);
        setError("Failed to load games.");
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

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

  const handleSelectGame = (id) => {
    router.push(`/game/play/${id}`);
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
    <div className="w-full flex flex-col items-center overflow-x-hidden">
      <h2 className="w-full text-center text-5xl font-semibold my-6">
        Play Games
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
                  <th className="text-center font-semibold py-2 w-1/3">Keywords</th>
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

                    <td className="bg-white px-4 py-3 text-center shadow rounded-r-xl truncate group-hover:bg-gray-50">
                      {Array.isArray(game.keywords)
                        ? game.keywords.join(", ")
                        : game.keywords || "None"}
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
          No published games available
        </p>
      )}
    </div>
  );
}
