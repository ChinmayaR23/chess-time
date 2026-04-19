"use client";

import { useEffect, useState } from "react";
import { PlayerColor } from "@/types/game";

interface UseChessClockOptions {
  whiteTimeLeft: number; // ms
  blackTimeLeft: number; // ms
  currentTurn: "w" | "b";
  gameOver: boolean;
}

export function useChessClock({
  whiteTimeLeft: initialWhite,
  blackTimeLeft: initialBlack,
  currentTurn,
  gameOver,
}: UseChessClockOptions) {
  const [whiteTime, setWhiteTime] = useState(initialWhite);
  const [blackTime, setBlackTime] = useState(initialBlack);
  const [turn, setTurn] = useState(currentTurn);

  // Sync when server sends new state
  useEffect(() => {
    setWhiteTime(initialWhite);
    setBlackTime(initialBlack);
    setTurn(currentTurn);
  }, [initialWhite, initialBlack, currentTurn]);

  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      if (turn === "w") {
        setWhiteTime((t) => Math.max(0, t - 100));
      } else {
        setBlackTime((t) => Math.max(0, t - 100));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [turn, gameOver]);

  return { whiteTime, blackTime };
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
