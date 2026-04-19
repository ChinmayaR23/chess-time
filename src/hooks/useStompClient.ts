"use client";

import { useEffect, useRef } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

let stompInstance: Client | null = null;

export function useStompClient(token?: string | null): Client {
  const ref = useRef<Client | null>(null);

  if (!stompInstance) {
    stompInstance = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws`),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 3000,
    });
  }

  ref.current = stompInstance;

  useEffect(() => {
    if (!stompInstance?.active) {
      stompInstance?.activate();
    }
    return () => {
      // Keep connection alive across route changes
    };
  }, []);

  return ref.current!;
}

export type { IMessage };
