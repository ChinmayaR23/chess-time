import { Friend, FriendRequestRecord, UserSearchResult } from "@/types/friend";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function fetchFriends(token: string): Promise<Friend[]> {
  const res = await fetch(`${API_URL}/api/friend/friends`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch friends");
  return res.json();
}

export async function fetchIncomingRequests(token: string): Promise<FriendRequestRecord[]> {
  const res = await fetch(`${API_URL}/api/friend/requests/incoming`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
}

export async function fetchOutgoingRequests(token: string): Promise<FriendRequestRecord[]> {
  const res = await fetch(`${API_URL}/api/friend/requests/outgoing`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
}

export async function sendFriendRequest(token: string, toUserId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/friend/request/${toUserId}`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to send request");
  }
}

export async function acceptFriendRequest(token: string, requestId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/friend/request/${requestId}/accept`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to accept request");
}

export async function declineFriendRequest(token: string, requestId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/friend/request/${requestId}/decline`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to decline request");
}

export async function removeFriend(token: string, friendId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/friend/${friendId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to remove friend");
}

export async function searchUsers(token: string, query: string): Promise<UserSearchResult[]> {
  const res = await fetch(
    `${API_URL}/api/friend/search?q=${encodeURIComponent(query)}`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}
