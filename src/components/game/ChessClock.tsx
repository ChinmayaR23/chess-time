"use client";

import { formatTime } from "@/hooks/useChessClock";
import styles from "./ChessClock.module.css";

interface ChessClockProps {
  timeMs: number;
  isActive: boolean;
}

export function ChessClock({ timeMs, isActive }: ChessClockProps) {
  const isLow = timeMs < 30_000;
  const cls = isActive
    ? isLow ? styles.activeLow : styles.active
    : styles.inactive;

  return <div className={`${styles.clock} ${cls}`}>{formatTime(timeMs)}</div>;
}
