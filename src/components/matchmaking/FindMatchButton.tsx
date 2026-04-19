"use client";

import styles from "./FindMatchButton.module.css";

interface FindMatchButtonProps {
  status: "idle" | "searching" | "matched";
  onFind: () => void;
  onCancel: () => void;
}

export function FindMatchButton({ status, onFind, onCancel }: FindMatchButtonProps) {
  if (status === "searching") {
    return (
      <button onClick={onCancel} className={`${styles.btn} ${styles.cancel}`}>
        <span className={styles.spinner} />
        Cancel Search
      </button>
    );
  }
  return (
    <button onClick={onFind} disabled={status === "matched"} className={`${styles.btn} ${styles.find}`}>
      Find Match
    </button>
  );
}
