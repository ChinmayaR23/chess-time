"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GameRoom } from "@/components/game/GameRoom";
import { PlayerColor } from "@/types/game";

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [timeControlMs, setTimeControlMs] = useState<number | null>(null);

  useEffect(() => {
    const storedColor = sessionStorage.getItem(`game-color-${gameId}`);
    if (storedColor === "white" || storedColor === "black") {
      setColor(storedColor);
    } else {
      setColor("white");
    }

    const storedTc = sessionStorage.getItem(`game-tc-${gameId}`);
    if (storedTc) setTimeControlMs(Number(storedTc) * 1000);
  }, [gameId]);

  if (!color) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <GameRoom gameId={gameId} initialColor={color} initialTimeMs={timeControlMs} />;
}
