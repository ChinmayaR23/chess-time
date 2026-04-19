const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  rating: number;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("chess-token");
}

export function setToken(token: string): void {
  localStorage.setItem("chess-token", token);
}

export function clearToken(): void {
  localStorage.removeItem("chess-token");
  localStorage.removeItem("chess-user");
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("chess-user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem("chess-user", JSON.stringify(user));
}

export function loginWithGithub(): void {
  window.location.href = `${API_URL}/oauth2/authorization/github`;
}

export function loginWithGoogle(): void {
  window.location.href = `${API_URL}/oauth2/authorization/google`;
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/user/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json();
}
