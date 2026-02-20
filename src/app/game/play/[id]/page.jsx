import { db } from "@/lib/firebase/firebaseAdmin";
import GamePlayerClient from "./playerClient";

export const dynamic = "force-dynamic";

function toPlayableLevel(levelId, level) {
  const question = typeof level?.question === "string" ? level.question : "";
  const trueFalseEnabled =
    level?.trueFalseEnabled === true || level?.trueFalseEnabled === "true";
  const trueFalseAnswer =
    typeof level?.trueFalseAnswer === "boolean" ? level.trueFalseAnswer : null;

  // options can be array OR RTDB object {0:"...",1:"..."} — keep as-is, builder normalizes
  const options = level?.options ?? [];

  return {
    // identity
    id: levelId,
    name: level?.name ?? "",
    description: level?.description ?? "",
    keywords: level?.keywords ?? "",

    // pose content
    poses: level?.poses ?? {},

    // ✅ INSIGHT inputs
    question,
    options,

    // ✅ INTUITION inputs
    trueFalseEnabled,
    trueFalseAnswer,

    // (keep if you use these elsewhere; harmless)
    answers: level?.answers ?? [],

    // ✅ pose matching config
    poseTolerancePctById:
      level?.poseTolerancePctById && typeof level.poseTolerancePctById === "object"
        ? level.poseTolerancePctById
        : {},
    poseThreshold: level?.poseThreshold ?? 60,
    poseDurationMS: level?.poseDurationMS ?? null,

    // tween config
    tweenDurationMS: level?.tweenDurationMS ?? null,
    tweenEasing: level?.tweenEasing ?? null,

    // optional per-level cursor settings passthrough
    settings: level?.settings ?? {},
    cursorDelayMS: level?.cursorDelayMS ?? null,
    introCursorDelayMS: level?.introCursorDelayMS ?? null,
    outroCursorDelayMS: level?.outroCursorDelayMS ?? null,
    poseCursorDelayMS: level?.poseCursorDelayMS ?? null,
  };
}

async function fetchGameAndLevels(gameId) {
  const gameSnapshot = await db.ref(`Games/${gameId}`).get();
  if (!gameSnapshot.exists()) throw new Error("Game not found.");

  const game = gameSnapshot.val();
  if (!game.isPublished) throw new Error("Game is not published.");

  const levelIds = game.levelIds ?? [];

  const levelSnapshots = await Promise.all(
    // NOTE: if your RTDB path is actually "Levels" not "level", change it here.
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
