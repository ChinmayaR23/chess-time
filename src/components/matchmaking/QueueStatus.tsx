"use client";

import styles from "./QueueStatus.module.css";

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function QueueStatus({ status, searchDuration }: { status: string; searchDuration: number }) {
  if (status === "matched") return <p className={styles.matched}>Match found! Loading game...</p>;
  if (status === "searching") return <p className={styles.searching}>Searching... {fmt(searchDuration)}</p>;
  return null;
}
