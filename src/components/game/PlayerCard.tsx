"use client";

import { ChessClock } from "./ChessClock";
import { PlayerInfo } from "@/types/game";
import styles from "./PlayerCard.module.css";

interface PlayerCardProps {
  player: PlayerInfo;
  timeMs: number;
  isActive: boolean;
}

export function PlayerCard({ player, timeMs, isActive }: PlayerCardProps) {
  const initials = player.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={styles.card}>
      <div className={styles.left}>
        <div className={styles.avatar}>{initials}</div>
        <div>
          <div className={styles.name}>{player.name}</div>
          <div className={styles.meta}>
            {player.rating}
            {player.isGuest && " (guest)"}
          </div>
        </div>
      </div>
      <ChessClock timeMs={timeMs} isActive={isActive} />
    </div>
  );
}
