export interface FriendUser {
  id: string;
  username: string;
  displayName?: string;
  email: string;
  avatarUrl: string | null;
  status: string;
}

export interface FriendResponse {
  friendshipId: string;
  user: FriendUser;
  status: string;
  since: string;
}

export interface PendingFriendResponse {
  friendshipId: string;
  user: FriendUser;
  incoming: boolean;
  requestedAt: string;
}

export interface DirectMessage {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
  recipientStatus: "ONLINE" | "OFFLINE" | "IDLE" | "DND";
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}
