export interface User {
  id: string;
  username: string;
  displayName?: string;
  email: string;
  avatarUrl: string | null;
  status: "ONLINE" | "OFFLINE" | "IDLE" | "DND";
  createdAt: string;
  lastSeenAt: string | null;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
