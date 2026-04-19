"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useStompClient } from "@/hooks/useStompClient";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import { FindMatchButton } from "@/components/matchmaking/FindMatchButton";
import { QueueStatus } from "@/components/matchmaking/QueueStatus";
import { getOrCreateGuestId, getOrCreateGuestName } from "@/lib/guest";
import { TIME_CONTROLS } from "@/types/game";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [tc, setTc] = useState(600);
  const [guestId, setGuestId] = useState("ssr");
  const [guestName, setGuestName] = useState("Guest");

  useEffect(() => {
    setGuestId(getOrCreateGuestId());
    setGuestName(getOrCreateGuestName());
  }, []);

  const client = useStompClient(token);

  const { status, searchDuration, gameId, color, findMatch, cancelSearch } = useMatchmaking({
    client,
    guestId,
    userId: user?.id,
    name: user?.name ?? guestName,
    rating: user?.rating ?? 1200,
  });

  useEffect(() => {
    if (status === "matched" && gameId) {
      sessionStorage.setItem(`game-color-${gameId}`, color ?? "white");
      router.push(`/game/${gameId}`);
    }
  }, [status, gameId, color, router]);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>chess<span className={styles.accent}>time</span></h1>
        <p className={styles.subtitle}>Instant matchmaking. Play someone your level.</p>
      </div>

      <div className={styles.card}>
        <p className={styles.label}>Time control</p>
        <div className={styles.timeGrid}>
          {TIME_CONTROLS.map((t) => (
            <button
              key={t.seconds}
              onClick={() => setTc(t.seconds)}
              disabled={status === "searching"}
              className={`${styles.timeBtn} ${tc === t.seconds ? styles.timeBtnActive : styles.timeBtnInactive}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.ratingRow}>
          <span className={styles.ratingLabel}>Your rating</span>
          <span className={styles.ratingValue}>
            {user?.rating ?? 1200}
            {!user && <span className={styles.guestNote}>(guest)</span>}
          </span>
        </div>

        <FindMatchButton status={status} onFind={() => findMatch(tc)} onCancel={cancelSearch} />
        <div className={styles.statusRow}><QueueStatus status={status} searchDuration={searchDuration} /></div>

        {!user && (
          <p className={styles.guestMsg}>
            Playing as guest. <a href="/login" className={styles.guestLink}>Sign in</a> to save your rating.
          </p>
        )}
      </div>
    </div>
  );
}
