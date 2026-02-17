import { db } from "@/lib/firebase/firebaseAdmin";
import GamePlayerClient from "./playerClient";

export const dynamic = "force-dynamic";

async function fetchGameAndLevels(gameId) {
  // Fetch game first to validate it's published and get levelIds
  const gameSnapshot = await db.ref(`Games/${gameId}`).get();

  if (!gameSnapshot.exists()) throw new Error("Game not found.");

  const game = gameSnapshot.val();
  if (!game.isPublished) throw new Error("Game is not published.");

  const levelIds = game.levelIds ?? [];

  // Fetch all levels in parallel
  const levelSnapshots = await Promise.all(
    levelIds.map((levelId) => db.ref(`level/${levelId}`).get())
  );

  const levels = levelSnapshots
    .map((snapshot, i) => {
      if (!snapshot.exists()) {
        console.log(`⚠️ Level ${levelIds[i]} not found`);
        return null;
      }
      const level = snapshot.val();
      return {
        id: levelIds[i],
        name: level.name ?? "",
        description: level.description ?? "",
        options: level.options ?? [],
        answers: level.answers ?? [],
        keywords: level.keywords ?? "",
        poses: level.poses ?? {},
      };
    })
    .filter(Boolean);

  const { pin, ...safeGame } = game;

  return {
    game: {
      id: gameId,
      name: safeGame.name ?? "",
      description: safeGame.description ?? "",
      keywords: safeGame.keywords ?? "",
      levelIds,
      storyline: safeGame.storyline ?? [],
      settings: safeGame.settings ?? {},
    },
    levels,
  };
}

export default async function Page({ params, searchParams }) {
  const { id: gameId } = await params;
  const { level } = await searchParams;

  const { game, levels } = await fetchGameAndLevels(gameId);
  const levelIndex = level ? Number(level) : 0;

  return (
    <GamePlayerClient
      game={game}
      levels={levels}
      levelIndex={Number.isFinite(levelIndex) ? levelIndex : 0}
    />
  );
}