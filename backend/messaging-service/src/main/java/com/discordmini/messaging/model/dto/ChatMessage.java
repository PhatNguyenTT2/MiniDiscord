package com.discordmini.messaging.model.dto;

import com.discordmini.common.event.ReplyInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {
    private String nonce;
    private List<String> mentions;
    private String id; // Pre-generated ObjectId
    private String messageId; // Optional, server can generate
    private String roomId;
    private String channelId;
    private String senderId; // Populated by server
    private String senderName; // Populated by server
    private String senderAvatar; // Populated by server
    private String content;
    private String type; // TEXT, IMAGE, FILE, SYSTEM
    private String fileKey;
    private String fileName;
    private Long fileSize;
    @com.fasterxml.jackson.annotation.JsonProperty("isForwarded")
    private boolean isForwarded;
    @com.fasterxml.jackson.annotation.JsonProperty("isPinned")
    private boolean isPinned;
    private String createdAt;
    private ReplyInfo replyTo;
}
