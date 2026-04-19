"use client";

import { useEffect, useRef } from "react";
import { MoveRecord } from "@/types/game";
import styles from "./MoveHistory.module.css";

export function MoveHistory({ moves }: { moves: MoveRecord[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves.length]);

  const rows: [MoveRecord, MoveRecord | null][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push([moves[i], moves[i + 1] ?? null]);
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Moves</h3>
      <div className={styles.list}>
        {rows.map(([white, black], i) => (
          <div key={i} className={styles.row}>
            <span className={styles.num}>{i + 1}.</span>
            <span className={styles.san}>{white.san}</span>
            {black && <span className={styles.san}>{black.san}</span>}
          </div>
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
