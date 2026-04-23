"use client";

import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import { PlayerColor } from "@/types/game";

interface UseMatchmakingOptions {
  client: Client;
  guestId: string;
  userId?: string;
  name: string;
  rating: number;
}

export function useMatchmaking({ client, guestId, userId, name, rating }: UseMatchmakingOptions) {
  const [status, setStatus] = useState<"idle" | "searching" | "matched">("idle");
  const [searchDuration, setSearchDuration] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [timeControl, setTimeControl] = useState<number | null>(null);
  const [opponent, setOpponent] = useState<{ name: string; rating: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      subRef.current?.unsubscribe();
    };
  }, []);

  const findMatch = (timeControl: number) => {
    if (status === "searching" || !client.active) return;
    setStatus("searching");
    setSearchDuration(0);

    // Subscribe to private matched notification
    subRef.current = client.subscribe("/user/queue/matched", (msg) => {
      const payload = JSON.parse(msg.body);
      setGameId(payload.gameId);
      setColor(payload.color);
      setTimeControl(payload.timeControl ?? null);
      setOpponent(payload.opponent ?? null);
      setStatus("matched");
      if (timerRef.current) clearInterval(timerRef.current);
      subRef.current?.unsubscribe();
    });

    client.publish({
      destination: "/app/queue/join",
      body: JSON.stringify({ rating, timeControl, userId, guestId, name }),
    });

    timerRef.current = setInterval(() => setSearchDuration((d) => d + 1), 1000);
  };

  const cancelSearch = () => {
    client.publish({ destination: "/app/queue/leave", body: JSON.stringify({ guestId }) });
    setStatus("idle");
    setSearchDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    subRef.current?.unsubscribe();
  };

  return { status, searchDuration, gameId, color, timeControl, opponent, findMatch, cancelSearch };
}
