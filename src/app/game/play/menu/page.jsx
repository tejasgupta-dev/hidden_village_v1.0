"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GameMenu() {
  const router = useRouter();

  const [games, setGames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

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

        // Only keep published games
        const publishedGames = Object.fromEntries(
          Object.entries(data.data).filter(([id, game]) => game.isPublished)
        );

        setGames(publishedGames);
      } catch (err) {
        console.error("Error fetching games:", err);
        setError("Failed to load games.");
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [router]);

  // Filter games by search
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
    return <p className="text-center text-xl py-8 text-black">Loading games...</p>;

  if (error)
    return (
      <p className="text-center text-xl py-8 text-black">
        ⚠️ {error}
      </p>
    );

  if (Object.keys(games).length === 0)
    return (
      <p className="pt-[10vh] text-black text-2xl text-center">
        No published games found
      </p>
    );

  return (
    <div className="w-full flex flex-col items-center overflow-x-hidden relative">
      <h2 className="w-full text-center text-5xl font-semibold my-6 text-black">
        Play Games
      </h2>

      <input
        placeholder="Search by name, author, or keyword"
        className="self-end mr-5 mb-8 w-1/4 min-w-[200px] h-10 px-4 text-lg text-black placeholder-gray-500 rounded-full border border-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredGames.length > 0 ? (
        <div className="w-[90%] overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-3 text-lg table-fixed">
            <thead>
              <tr className="text-black">
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
                  <td className="bg-white px-4 py-3 text-center text-black shadow rounded-l-xl truncate group-hover:bg-gray-100">
                    {game.name || "Untitled Game"}
                  </td>

                  <td className="bg-white px-4 py-3 text-center text-black shadow truncate group-hover:bg-gray-100">
                    {game.author || "Unknown"}
                  </td>

                  <td className="bg-white px-4 py-3 text-center text-black shadow rounded-r-xl truncate group-hover:bg-gray-100">
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
        <p className="pt-[10vh] text-black text-2xl text-center">
          No games match your search
        </p>
      )}
    </div>
  );
}