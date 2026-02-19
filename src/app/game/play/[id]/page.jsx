import { db } from "@/lib/firebase/firebaseAdmin";
import GamePlayerClient from "./playerClient";

export const dynamic = "force-dynamic";

function toPlayableLevel(levelId, level) {
  return {
    id: levelId,
    name: level?.name ?? "",
    description: level?.description ?? "",
    options: level?.options ?? [],
    answers: level?.answers ?? [],
    keywords: level?.keywords ?? "",
    poses: level?.poses ?? {},

    // ✅ FIX: include tolerance + timing settings so buildStateNodesForLevel can see them
    poseTolerancePctById:
      level?.poseTolerancePctById && typeof level.poseTolerancePctById === "object"
        ? level.poseTolerancePctById
        : {},
    poseThreshold: level?.poseThreshold ?? 60,
    poseDurationMS: level?.poseDurationMS ?? null,
    tweenDurationMS: level?.tweenDurationMS ?? null,
    tweenEasing: level?.tweenEasing ?? null,
  };
}

async function fetchGameAndLevels(gameId) {
  const gameSnapshot = await db.ref(`Games/${gameId}`).get();
  if (!gameSnapshot.exists()) throw new Error("Game not found.");

  const game = gameSnapshot.val();
  if (!game.isPublished) throw new Error("Game is not published.");

  const levelIds = game.levelIds ?? [];

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
      return toPlayableLevel(levelIds[i], level);
    })
    .filter(Boolean);

  const { pin, ...safeGame } = game;

  // ✅ optional debug: confirm tolerance arrived from DB
  // console.log("[page] first level tolerance map:", levels?.[0]?.poseTolerancePctById);

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
  // ✅ keep exactly how you had it
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
