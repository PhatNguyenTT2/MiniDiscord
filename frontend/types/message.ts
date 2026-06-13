export type MessageStatus = "SENDING" | "SENT" | "FAILED";

export interface Message {
  id: string; // ObjectId from DB or temporary UUID
  status?: MessageStatus;
  nonce?: string;
  messageId?: string; // Always UUID from WebSocket
  roomId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  type: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
  content: string;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  reactions: Reaction[];
  isEdited: boolean;
  isDeleted: boolean;
  isPinned?: boolean;
  isForwarded?: boolean;
  editedAt: string | null;
  createdAt: string;
  replyTo: ReplyReference | null;
  mentions?: string[];
  stickerIds?: string[];
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
  fileKey?: string;
  isForwarded?: boolean;
  mentions?: string[];
  stickerIds?: string[];
}

export interface TypingEvent {
  roomId: string;
  userId: string;
  username: string;
}
