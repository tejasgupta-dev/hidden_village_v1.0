"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PlayGameMenu() {
  const router = useRouter();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const handleBack = () => router.back();

  const inputClass =
    "w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 " +
    "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-gray-900";

  /* =========================================
     FETCH PUBLIC (PUBLISHED) GAMES
  ========================================= */
  useEffect(() => {
    let mounted = true;

    const fetchGames = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/games?mode=public", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json();

        if (!mounted) return;

        if (!res.ok || !data?.success) {
          setError(data?.message || "Failed to load games.");
          setGames([]);
          return;
        }

        setGames(Array.isArray(data.games) ? data.games : []);
      } catch (err) {
        console.error("Error fetching games:", err);
        if (mounted) {
          setError("Failed to load games.");
          setGames([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchGames();
    return () => {
      mounted = false;
    };
  }, []);

  /* =========================================
     SEARCH
  ========================================= */
  const filteredGames = useMemo(() => {
    if (!Array.isArray(games)) return [];
    const q = (search || "").trim();
    if (!q) return games;

    // regex-safe
    try {
      const reg = new RegExp(q, "i");
      return games.filter(
        (g) => reg.test(g?.name || "") || reg.test(g?.keywords || "")
      );
    } catch {
      const lower = q.toLowerCase();
      return games.filter((g) => {
        const name = (g?.name || "").toLowerCase();
        const keywords = (g?.keywords || "").toLowerCase();
        return name.includes(lower) || keywords.includes(lower);
      });
    }
  }, [games, search]);

  const handleSelectGame = (id) => {
    if (!id) return;
    router.push(`/game/play/${id}`);
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header (matches GameMenu) */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          <ArrowLeft size={18} /> Back
        </button>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Play Games</h2>
          <p className="text-sm text-gray-600 mt-1">
            Choose a published game to start playing.
          </p>
        </div>

        <div className="w-[64px]" />
      </div>

      {/* Search card (matches GameMenu) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <input
          placeholder="Search by name or keyword"
          className={inputClass}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table card (matches GameMenu) */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {games.length === 0 ? (
          <div className="text-center text-gray-600 py-12">
            No published games available
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center text-gray-600 py-12">
            No games match your search
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
                    Keywords
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredGames.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => handleSelectGame(g.id)}
                    className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-[420px] truncate">
                      {g.name || "Untitled Game"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-[520px] truncate">
                      {g.keywords || "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredGames.length > 0 ? (
        <p className="text-xs text-gray-500">Tip: Click a row to start playing.</p>
      ) : null}
    </div>
  );
}
