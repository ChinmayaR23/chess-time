"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Client } from "@stomp/stompjs";
import { GameInvite } from "@/types/friend";
import { TIME_CONTROLS } from "@/types/game";
import styles from "./GameInviteToast.module.css";

interface Props {
  client: Client;
  userId: string;
}

export function GameInviteToast({ client, userId }: Props) {
  const router = useRouter();
  const [invite, setInvite] = useState<GameInvite | null>(null);
  const [state, setState] = useState<"idle" | "accepting" | "waiting">("idle");
  const inviteSubRef = useRef<{ unsubscribe: () => void } | null>(null);
  const matchedSubRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    let attempted = false;

    const subscribe = () => {
      if (attempted) return;
      attempted = true;
      inviteSubRef.current = client.subscribe("/user/queue/friend-invite", (msg) => {
        const data: GameInvite = JSON.parse(msg.body);
        setInvite(data);
        setState("idle");
      });
    };

    if (client.connected) {
      subscribe();
    } else {
      const interval = setInterval(() => {
        if (client.connected) {
          clearInterval(interval);
          subscribe();
        }
      }, 500);
      return () => {
        clearInterval(interval);
        inviteSubRef.current?.unsubscribe();
        matchedSubRef.current?.unsubscribe();
      };
    }

    return () => {
      inviteSubRef.current?.unsubscribe();
      matchedSubRef.current?.unsubscribe();
    };
  }, [client, userId]);

  const accept = () => {
    if (!invite) return;
    setState("waiting");

    matchedSubRef.current = client.subscribe("/user/queue/matched", (msg) => {
      const payload = JSON.parse(msg.body);
      matchedSubRef.current?.unsubscribe();
      sessionStorage.setItem(`game-color-${payload.gameId}`, payload.color);
      setInvite(null);
      router.push(`/game/${payload.gameId}`);
    });

    client.publish({
      destination: "/app/friend/invite-response",
      body: JSON.stringify({ inviteId: invite.inviteId, accepted: true }),
    });
  };

  const decline = () => {
    if (!invite) return;
    client.publish({
      destination: "/app/friend/invite-response",
      body: JSON.stringify({ inviteId: invite.inviteId, accepted: false }),
    });
    setInvite(null);
    setState("idle");
  };

  if (!invite) return null;

  const tcLabel = TIME_CONTROLS.find((t) => t.seconds === invite.timeControl)?.label
    ?? `${Math.floor(invite.timeControl / 60)} min`;

  return (
    <div className={styles.toast}>
      <div className={styles.header}>Game invite</div>
      <div className={styles.from}>
        <span className={styles.name}>{invite.fromName}</span>
        <span className={styles.rating}>{invite.fromRating}</span>
      </div>
      <div className={styles.tc}>{tcLabel} · Friendly match</div>
      {state === "waiting" ? (
        <div className={styles.waiting}>Setting up game...</div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.acceptBtn} onClick={accept}>Accept</button>
          <button className={styles.declineBtn} onClick={decline}>Decline</button>
        </div>
      )}
    </div>
  );
}
