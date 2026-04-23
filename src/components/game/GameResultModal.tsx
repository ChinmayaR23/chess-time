"use client";

import { useRouter } from "next/navigation";
import { PlayerColor } from "@/types/game";
import styles from "./GameResultModal.module.css";

type GameResult = "WHITE_WINS" | "BLACK_WINS" | "DRAW" | "ABORTED";

interface GameResultModalProps {
  result: GameResult;
  winner: PlayerColor | null;
  myColor: PlayerColor;
  ratingDelta?: { white: number; black: number };
}

export function GameResultModal({ result, winner, myColor, ratingDelta }: GameResultModalProps) {
  const router = useRouter();
  const myDelta = myColor === "white" ? ratingDelta?.white : ratingDelta?.black;

  let title: string;
  let titleCls: string;
  let subtitle: string;

  if (result === "DRAW") {
    title = "Draw"; titleCls = styles.draw; subtitle = "By agreement or stalemate";
  } else if (result === "ABORTED") {
    title = "Aborted"; titleCls = styles.aborted; subtitle = "Opponent disconnected";
  } else if (winner === myColor) {
    title = "You Win!"; titleCls = styles.win; subtitle = "Well played!";
  } else {
    title = "You Lose"; titleCls = styles.loss;
    subtitle = result === "WHITE_WINS" ? "White wins" : "Black wins";
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={`${styles.title} ${titleCls}`}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>

        {myDelta !== undefined && (
          <div className={`${styles.delta} ${myDelta >= 0 ? styles.deltaPositive : styles.deltaNegative}`}>
            {myDelta >= 0 ? "+" : ""}{myDelta} rating
          </div>
        )}

        <div className={styles.actions}>
          <button onClick={() => router.push("/")} className={styles.playAgainBtn}>Home</button>
          <button onClick={() => router.push("/profile")} className={styles.profileBtn}>View Profile</button>
        </div>
      </div>
    </div>
  );
}
