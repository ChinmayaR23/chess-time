"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = params.get("token");

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

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallback />
    </Suspense>
  );
}
