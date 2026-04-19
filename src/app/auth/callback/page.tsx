"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken, setStoredUser } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = params.get("token");
    const name = params.get("name") ?? "";
    const rating = parseInt(params.get("rating") ?? "1200", 10);

    if (token) {
      setToken(token);
      refreshUser().then(() => router.replace("/"));
    } else {
      router.replace("/login");
    }
  }, [params, router, refreshUser]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)" }}>
      <div style={{ width: 32, height: 32, border: "2px solid #4ade80", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
    </div>
  );
}
