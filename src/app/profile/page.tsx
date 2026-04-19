"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getToken } from "@/lib/auth";
import styles from "./page.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface GameRecord {
  id: string;
  result: string | null;
  winner: string | null;
  myColor: string;
  timeControl: number;
  endedAt: string;
  whiteName: string;
  blackName: string;
  whiteRating: number;
  blackRating: number;
  ratingChange?: { ratingBefore: number; ratingAfter: number; delta: number };
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    fetch(`${API}/api/user/games`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setGames(data); setFetching(false); });
  }, [user]);

  if (!user) return null;

  const wins = games.filter(g => (g.myColor === "white" && g.result === "WHITE_WINS") || (g.myColor === "black" && g.result === "BLACK_WINS")).length;
  const losses = games.filter(g => (g.myColor === "white" && g.result === "BLACK_WINS") || (g.myColor === "black" && g.result === "WHITE_WINS")).length;
  const draws = games.filter(g => g.result === "DRAW").length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.avatar}>{user.name?.slice(0, 2).toUpperCase() ?? "?"}</div>
        <div>
          <div className={styles.name}>{user.name}</div>
          <div className={styles.email}>{user.email}</div>
          <div className={styles.ratingRow}>
            <span className={styles.ratingNum}>{user.rating}</span>
            <span className={styles.ratingLabel}>rating</span>
          </div>
        </div>
      </div>

      <div className={styles.stats}>
        {[{ label: "Wins", val: wins, cls: styles.win }, { label: "Losses", val: losses, cls: styles.loss }, { label: "Draws", val: draws, cls: styles.draw }].map(s => (
          <div key={s.label} className={styles.statCard}>
            <div className={`${styles.statNum} ${s.cls}`}>{s.val}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className={styles.gamesCard}>
        <h2 className={styles.gamesTitle}>Recent Games</h2>
        {fetching ? <div className={styles.empty}>Loading...</div> : games.length === 0 ? <div className={styles.empty}>No games yet.</div> : (
          games.map(g => {
            const isWin = (g.myColor === "white" && g.result === "WHITE_WINS") || (g.myColor === "black" && g.result === "BLACK_WINS");
            const isDraw = g.result === "DRAW";
            const opponent = g.myColor === "white" ? g.blackName : g.whiteName;
            const oppRating = g.myColor === "white" ? g.blackRating : g.whiteRating;
            return (
              <div key={g.id} className={styles.gameRow}>
                <div className={styles.gameLeft}>
                  <span className={`${styles.dot} ${isWin ? styles.dotWin : isDraw ? styles.dotDraw : styles.dotLoss}`} />
                  <div>
                    <div className={styles.opponent}>vs {opponent} <span className={styles.opponentRating}>({oppRating})</span></div>
                    <div className={styles.gameMeta}>{Math.floor(g.timeControl / 60)} min · {isWin ? "Win" : isDraw ? "Draw" : "Loss"} · {g.myColor}</div>
                  </div>
                </div>
                {g.ratingChange && (
                  <span className={`${styles.delta} ${g.ratingChange.delta >= 0 ? styles.deltaPos : styles.deltaNeg}`}>
                    {g.ratingChange.delta >= 0 ? "+" : ""}{g.ratingChange.delta}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
