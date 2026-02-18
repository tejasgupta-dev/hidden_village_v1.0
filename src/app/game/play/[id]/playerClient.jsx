"use client";

import { useRouter } from "next/navigation";
import GamePlayerRoot from "@/lib/gamePlayer/gamePlayerRoot";

export default function GamePlayerClient({ game, levels, levelIndex }) {
  const router = useRouter();
  const gameWithLevels = { ...game, levels };

  return (
    <GamePlayerRoot
      game={gameWithLevels}
      levelIndex={levelIndex}
      deviceId="web"
      onComplete={() => {
        router.back();
      }}
    />
  );
}