export interface Friend {
  id: string;
  name: string;
  rating: number;
  image?: string;
}

export interface FriendRequestRecord {
  id: string;
  fromUser?: Friend;
  toUser?: Friend;
  createdAt: string;
}

export type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "friends";

export interface UserSearchResult {
  id: string;
  name: string;
  rating: number;
  image?: string;
  friendshipStatus: FriendshipStatus;
}

export interface GameInvite {
  inviteId: string;
  fromUserId: string;
  fromName: string;
  fromRating: number;
  timeControl: number;
}
