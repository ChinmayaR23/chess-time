"use client";

import { useAuth } from "@/context/AuthContext";
import { useStompClient } from "@/hooks/useStompClient";
import { GameInviteToast } from "./GameInviteToast";

export function FriendInviteListener() {
  const { user, token } = useAuth();
  const client = useStompClient(token);

  if (!user) return null;

  return <GameInviteToast client={client} userId={user.id} />;
}
