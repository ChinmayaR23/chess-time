"use client";

import { AuthProvider } from "@/context/AuthContext";
import { FriendInviteListener } from "@/components/friends/FriendInviteListener";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FriendInviteListener />
      {children}
    </AuthProvider>
  );
}
