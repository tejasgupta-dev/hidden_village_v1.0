"use client";

import GamePlayerRoot from "@/lib/gamePlayer/gamePlayerRoot";

export default function GamePlayerClient({ game, levels, levelIndex }) {
  const gameWithLevels = { ...game, levels };

  return (
    <GamePlayerRoot
      game={gameWithLevels}
      levelIndex={levelIndex}
      deviceId="web"
      onComplete={() => {}}
    />
  );
}