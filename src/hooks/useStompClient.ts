"use client";

import { useEffect, useRef } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

let stompInstance: Client | null = null;
let activeToken: string | null = null;

export function useStompClient(token?: string | null): Client {
  const incoming = token ?? null;

  if (!stompInstance) {
    stompInstance = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws`),
      connectHeaders: incoming ? { Authorization: `Bearer ${incoming}` } : {},
      reconnectDelay: 3000,
    });
    activeToken = incoming;
  }

  const ref = useRef<Client>(stompInstance);

  useEffect(() => {
    if (!stompInstance?.active) {
      stompInstance?.activate();
    }
  }, []);

  // When a token becomes available after the client was created without one,
  // reconnect so the server can authenticate the WebSocket principal.
  useEffect(() => {
    if (!incoming || incoming === activeToken) return;
    activeToken = incoming;
    if (stompInstance) {
      stompInstance.connectHeaders = { Authorization: `Bearer ${incoming}` };
      if (stompInstance.active) {
        stompInstance.deactivate().then(() => stompInstance?.activate());
      }
    }
  }, [incoming]);

  return ref.current!;
}

export type { IMessage };
