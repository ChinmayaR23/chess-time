"use client";

import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import styles from "./GameChat.module.css";

interface ChatMsg { senderName: string; content: string; createdAt: string; }

interface GameChatProps {
  client: Client;
  gameId: string;
  myName: string;
  myUserId?: string;
}

export function GameChat({ client, gameId, myName, myUserId }: GameChatProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!client.active) return;
    const sub = client.subscribe(`/topic/game/${gameId}`, (msg) => {
      const data = JSON.parse(msg.body);
      if (data.type === "chat") setMessages((prev) => [...prev, data]);
    });
    return () => sub.unsubscribe();
  }, [client, gameId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = () => {
    if (!input.trim()) return;
    client.publish({
      destination: "/app/chat/message",
      body: JSON.stringify({ gameId, content: input.trim(), senderName: myName, senderId: myUserId }),
    });
    setInput("");
  };

  return (
    <div className={styles.container} style={{ height: open ? 280 : 40 }}>
      <button onClick={() => setOpen(!open)} className={styles.toggle}>
        <span>Chat</span><span>{open ? "▼" : "▲"}</span>
      </button>
      {open && (
        <>
          <div className={styles.messages}>
            {messages.map((m, i) => (
              <div key={i} className={styles.message}>
                <span className={styles.sender}>{m.senderName}: </span>
                <span className={styles.content}>{m.content}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={500}
              placeholder="Type a message..."
            />
            <button onClick={send} className={styles.sendBtn}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}
