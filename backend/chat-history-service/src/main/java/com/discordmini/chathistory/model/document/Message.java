package com.discordmini.chathistory.model.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

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
    private String fileKey;
    private String fileName;
    private Long fileSize;

    @Indexed
    @Builder.Default
    private List<String> mentions = new ArrayList<>();

    // Edit/Delete tracking
    @Builder.Default
    private boolean isEdited = false;
    @Builder.Default
    private boolean isDeleted = false;
    @Builder.Default
    private boolean isPinned = false;
    @Builder.Default
    private boolean isForwarded = false;
    private Instant deletedAt; // TTL anchor
    @Builder.Default
    private List<String> deletedForUsers = new ArrayList<>();
    // Timestamps
    private Instant createdAt;
    private Instant updatedAt;

    // Reply reference (optional)
    private ReplyTo replyTo;

    // Reactions
    @Builder.Default
    private List<Reaction> reactions = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Reaction {
        private String emoji;
        private List<String> userIds;
    }

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
