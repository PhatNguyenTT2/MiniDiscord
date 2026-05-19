package com.discordmini.chathistory.model.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "messages")
public class Message {

    @Id
    private String id; // ObjectId auto-generated — used as CURSOR

    @Indexed(unique = true)
    private String messageId; // UUID from event — Idempotent Consumer key

    private String roomId;
    private String channelId;
    private String senderId;
    private String senderName;
    private String senderAvatar;

    private String type; // TEXT, IMAGE, FILE, SYSTEM
    private String content;

    // File attachment (optional)
    private String fileUrl;
    private String fileName;
    private Long fileSize;

    // Edit/Delete tracking
    @Builder.Default
    private boolean isEdited = false;
    @Builder.Default
    private boolean isDeleted = false;
    private Instant deletedAt; // TTL anchor

    // Timestamps
    private Instant createdAt;
    private Instant updatedAt;

    // Reply reference (optional)
    private ReplyTo replyTo;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReplyTo {
        private String messageId; // UUID of event, NOT ObjectId
        private String content;
        private String senderName;
    }
}
