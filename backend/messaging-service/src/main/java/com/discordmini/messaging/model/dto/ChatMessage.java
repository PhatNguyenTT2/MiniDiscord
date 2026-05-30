package com.discordmini.messaging.model.dto;

import com.discordmini.common.event.ReplyInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {
    private String id; // Pre-generated ObjectId
    private String messageId; // Optional, server can generate
    private String roomId;
    private String channelId;
    private String senderId; // Populated by server
    private String senderName; // Populated by server
    private String senderAvatar; // Populated by server
    private String content;
    private String type; // TEXT, IMAGE, FILE, SYSTEM
    private String fileUrl;
    private String fileName;
    private Long fileSize;
    private String createdAt;
    private ReplyInfo replyTo;
}
