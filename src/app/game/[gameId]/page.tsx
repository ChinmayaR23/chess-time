"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GameRoom } from "@/components/game/GameRoom";
import { PlayerColor } from "@/types/game";

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [color, setColor] = useState<PlayerColor | null>(null);

  useEffect(() => {
    // Read color assigned during matchmaking
    const stored = sessionStorage.getItem(`game-color-${gameId}`);
    if (stored === "white" || stored === "black") {
      setColor(stored);
    } else {
      // Default white if arriving via direct link (spectator/reconnect)
      setColor("white");
    }
  }, [gameId]);

  if (!color) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <GameRoom gameId={gameId} initialColor={color} />;
}
