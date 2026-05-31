export interface Message {
  id: string; // ObjectId from DB or temporary UUID
  messageId?: string; // Always UUID from WebSocket
  roomId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  type: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
  content: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileKey?: string | null; // Added for Pre-signed URLs
  reactions: Reaction[];
  isEdited: boolean;
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
  replyTo: ReplyReference | null;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface ReplyReference {
  messageId: string;
  content: string;
  senderName: string;
}

export interface ChatMessage {
  roomId: string;
  channelId: string;
  content: string;
  type: "TEXT" | "IMAGE" | "FILE";
  fileUrl?: string;
  fileKey?: string; // Added for Pre-signed URLs
}

export interface TypingEvent {
  roomId: string;
  userId: string;
  username: string;
}
