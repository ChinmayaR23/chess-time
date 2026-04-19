"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useStompClient } from "@/hooks/useStompClient";
import { getToken } from "@/lib/auth";
import {
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  searchUsers,
} from "@/lib/friends";
import { Friend, FriendRequestRecord, UserSearchResult } from "@/types/friend";
import { TIME_CONTROLS } from "@/types/game";
import styles from "./page.module.css";

type Tab = "friends" | "requests" | "search";

export default function FriendsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const client = useStompClient(token);

  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestRecord[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<Friend | null>(null);
  const [inviteTimeControl, setInviteTimeControl] = useState(600);
  const [inviteSent, setInviteSent] = useState(false);
  const [declinedMsg, setDeclinedMsg] = useState<string | null>(null);
  const matchedSubRef = useRef<{ unsubscribe: () => void } | null>(null);
  const declinedSubRef = useRef<{ unsubscribe: () => void } | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    loadAll(token);
  }, [token]);

  // Subscribe to invite declined notification
  useEffect(() => {
    if (!client || !user) return;

    const subscribe = () => {
      declinedSubRef.current = client.subscribe("/user/queue/friend-invite-declined", (msg) => {
        const data = JSON.parse(msg.body);
        setInviteSent(false);
        setInviteTarget(null);
        setDeclinedMsg(data.message ?? "Invite declined.");
        setTimeout(() => setDeclinedMsg(null), 4000);
      });
    };

    if (client.connected) {
      subscribe();
    } else {
      const interval = setInterval(() => {
        if (client.connected) { clearInterval(interval); subscribe(); }
      }, 500);
      return () => { clearInterval(interval); declinedSubRef.current?.unsubscribe(); };
    }
    return () => declinedSubRef.current?.unsubscribe();
  }, [client, user]);

  const loadAll = async (t: string) => {
    const [f, inc, out] = await Promise.all([
      fetchFriends(t).catch(() => [] as Friend[]),
      fetchIncomingRequests(t).catch(() => [] as FriendRequestRecord[]),
      fetchOutgoingRequests(t).catch(() => [] as FriendRequestRecord[]),
    ]);
    setFriends(f);
    setIncoming(inc);
    setOutgoing(out);
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      if (!token) return;
      setSearching(true);
      const results = await searchUsers(token, q).catch(() => []);
      setSearchResults(results);
      setSearching(false);
    }, 400);
  };

  const handleSendRequest = async (toUserId: string) => {
    if (!token) return;
    await sendFriendRequest(token, toUserId).catch(() => {});
    setSearchResults((prev) =>
      prev.map((u) => u.id === toUserId ? { ...u, friendshipStatus: "pending_sent" } : u)
    );
  };

  const handleAccept = async (requestId: string) => {
    if (!token) return;
    await acceptFriendRequest(token, requestId);
    await loadAll(token);
  };

  const handleDecline = async (requestId: string) => {
    if (!token) return;
    await declineFriendRequest(token, requestId);
    setIncoming((prev) => prev.filter((r) => r.id !== requestId));
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!token) return;
    await removeFriend(token, friendId);
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
  };

  const openInvite = (friend: Friend) => {
    setInviteTarget(friend);
    setInviteSent(false);
    setInviteTimeControl(600);
  };

  const sendGameInvite = () => {
    if (!inviteTarget || !user) return;
    setInviteSent(true);

    matchedSubRef.current?.unsubscribe();
    matchedSubRef.current = client.subscribe("/user/queue/matched", (msg) => {
      const payload = JSON.parse(msg.body);
      matchedSubRef.current?.unsubscribe();
      sessionStorage.setItem(`game-color-${payload.gameId}`, payload.color);
      setInviteTarget(null);
      router.push(`/game/${payload.gameId}`);
    });

    client.publish({
      destination: "/app/friend/invite",
      body: JSON.stringify({ toUserId: inviteTarget.id, timeControl: inviteTimeControl }),
    });
  };

  const cancelInvite = () => {
    matchedSubRef.current?.unsubscribe();
    setInviteTarget(null);
    setInviteSent(false);
  };

  if (!user) return null;

  const incomingCount = incoming.length;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Friends</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "friends" ? styles.tabActive : ""}`}
          onClick={() => setTab("friends")}
        >
          Friends <span className={styles.badge}>{friends.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === "requests" ? styles.tabActive : ""}`}
          onClick={() => setTab("requests")}
        >
          Requests {incomingCount > 0 && <span className={styles.badgeAlert}>{incomingCount}</span>}
        </button>
        <button
          className={`${styles.tab} ${tab === "search" ? styles.tabActive : ""}`}
          onClick={() => setTab("search")}
        >
          Find Players
        </button>
      </div>

      {declinedMsg && <div className={styles.declinedBanner}>{declinedMsg}</div>}

      {/* FRIENDS TAB */}
      {tab === "friends" && (
        <div className={styles.card}>
          {friends.length === 0 ? (
            <div className={styles.empty}>
              No friends yet. Use <strong>Find Players</strong> to add some.
            </div>
          ) : (
            friends.map((f) => (
              <div key={f.id} className={styles.row}>
                <div className={styles.avatar}>{f.name.slice(0, 2).toUpperCase()}</div>
                <div className={styles.info}>
                  <div className={styles.rowName}>{f.name}</div>
                  <div className={styles.rowRating}>{f.rating} rating</div>
                </div>
                <div className={styles.rowActions}>
                  <button className={styles.inviteBtn} onClick={() => openInvite(f)}>
                    Invite to Game
                  </button>
                  <button
                    className={styles.removeBtn}
                    onClick={() => handleRemoveFriend(f.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* REQUESTS TAB */}
      {tab === "requests" && (
        <div className={styles.card}>
          {incoming.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Incoming</div>
              {incoming.map((r) => (
                <div key={r.id} className={styles.row}>
                  <div className={styles.avatar}>
                    {r.fromUser?.name.slice(0, 2).toUpperCase() ?? "?"}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.rowName}>{r.fromUser?.name}</div>
                    <div className={styles.rowRating}>{r.fromUser?.rating} rating</div>
                  </div>
                  <div className={styles.rowActions}>
                    <button className={styles.acceptBtn} onClick={() => handleAccept(r.id)}>
                      Accept
                    </button>
                    <button className={styles.declineBtn} onClick={() => handleDecline(r.id)}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {outgoing.length > 0 && (
            <>
              <div className={styles.sectionLabel} style={{ marginTop: incoming.length ? "1.5rem" : 0 }}>
                Sent
              </div>
              {outgoing.map((r) => (
                <div key={r.id} className={styles.row}>
                  <div className={styles.avatar}>
                    {r.toUser?.name.slice(0, 2).toUpperCase() ?? "?"}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.rowName}>{r.toUser?.name}</div>
                    <div className={styles.rowRating}>{r.toUser?.rating} rating</div>
                  </div>
                  <div className={styles.pendingLabel}>Pending</div>
                </div>
              ))}
            </>
          )}

          {incoming.length === 0 && outgoing.length === 0 && (
            <div className={styles.empty}>No pending requests.</div>
          )}
        </div>
      )}

      {/* SEARCH TAB */}
      {tab === "search" && (
        <div className={styles.card}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          {searching && <div className={styles.empty}>Searching...</div>}
          {!searching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
            <div className={styles.empty}>No users found.</div>
          )}
          {searchResults.map((u) => (
            <div key={u.id} className={styles.row}>
              <div className={styles.avatar}>{u.name.slice(0, 2).toUpperCase()}</div>
              <div className={styles.info}>
                <div className={styles.rowName}>{u.name}</div>
                <div className={styles.rowRating}>{u.rating} rating</div>
              </div>
              <div className={styles.rowActions}>
                {u.friendshipStatus === "friends" && (
                  <span className={styles.statusFriends}>Friends</span>
                )}
                {u.friendshipStatus === "pending_sent" && (
                  <span className={styles.statusPending}>Requested</span>
                )}
                {u.friendshipStatus === "pending_received" && (
                  <button className={styles.acceptBtn} onClick={() => setTab("requests")}>
                    Accept
                  </button>
                )}
                {u.friendshipStatus === "none" && (
                  <button
                    className={styles.addBtn}
                    onClick={() => handleSendRequest(u.id)}
                  >
                    Add Friend
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INVITE MODAL */}
      {inviteTarget && (
        <div className={styles.modalOverlay} onClick={cancelInvite}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Invite to Game</div>
            <div className={styles.modalSubtitle}>
              Challenging <strong>{inviteTarget.name}</strong>
            </div>
            {!inviteSent ? (
              <>
                <div className={styles.tcLabel}>Time control</div>
                <div className={styles.tcGrid}>
                  {TIME_CONTROLS.map((t) => (
                    <button
                      key={t.seconds}
                      className={`${styles.tcBtn} ${inviteTimeControl === t.seconds ? styles.tcBtnActive : styles.tcBtnInactive}`}
                      onClick={() => setInviteTimeControl(t.seconds)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.sendInviteBtn} onClick={sendGameInvite}>
                    Send Invite
                  </button>
                  <button className={styles.cancelBtn} onClick={cancelInvite}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.waitingInvite}>
                <div className={styles.waitingDot} />
                Waiting for {inviteTarget.name} to accept...
                <button className={styles.cancelSmall} onClick={cancelInvite}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
