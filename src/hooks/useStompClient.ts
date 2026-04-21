"use client";

import { useEffect, useRef, useState } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

let stompInstance: Client | null = null;
let activeToken: string | null = null;

// Listeners notified on every successful STOMP connect (initial + reconnects).
// Components add themselves here to trigger effect re-runs after reconnect.
const connectionListeners = new Set<() => void>();

export function useStompClient(token?: string | null): Client {
  const incoming = token ?? null;

  if (!stompInstance) {
    stompInstance = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws`),
      connectHeaders: incoming ? { Authorization: `Bearer ${incoming}` } : {},
      reconnectDelay: 3000,
      onConnect: () => connectionListeners.forEach((fn) => fn()),
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

/** Returns a counter that increments on every STOMP (re)connect.
 *  Add to useEffect deps to automatically resubscribe after reconnect. */
export function useConnectionId(): number {
  const [id, setId] = useState(0);
  useEffect(() => {
    const notify = () => setId((n) => n + 1);
    connectionListeners.add(notify);
    return () => {
      connectionListeners.delete(notify);
    };
  }, []);
  return id;
}

export type { IMessage };
