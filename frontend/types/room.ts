export interface Room {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  type: "GROUP" | "DM";
  ownerId: string;
  createdAt: string;
}

export interface RoomParticipant {
  id: string;
  userId: string;
  roomId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
  mutedUntil: string | null;
}

export interface Channel {
  id: string;
  roomId: string;
  name: string;
  type: "TEXT" | "VOICE";
  position: number;
  topic?: string | null;
  isPrivate?: boolean;
}


export interface CreateRoomRequest {
  name: string;
  description?: string;
  type: "GROUP" | "DM";
}

export interface MemberDetailResponse {
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
  displayName?: string;
  mutedUntil?: string | null;
  createdAt?: string;
}

export interface RoleResponse {
  id: string;
  name: string;
  position: number;
  color: string;
  permissions: Record<string, boolean>;
}

