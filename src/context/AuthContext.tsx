"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthUser, clearToken, fetchMe, getStoredUser, getToken, setStoredUser } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  signOut: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const t = getToken();
    if (!t) { setLoading(false); return; }
    try {
      const me = await fetchMe(t);
      setUser(me);
      setToken(t);
      setStoredUser(me);
    } catch {
      clearToken();
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fast path: use cached user from localStorage while fetching fresh data
    const cached = getStoredUser();
    if (cached) {
      setUser(cached);
      setToken(getToken());
    }
    refreshUser();
  }, []);

  const signOut = () => {
    clearToken();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
