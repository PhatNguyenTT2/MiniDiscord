package com.discordmini.chathistory.model.dto;

import com.discordmini.chathistory.model.document.Message;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {

    private String id; // ObjectId — cursor for pagination
    private String messageId; // UUID
    private String nonce;
    private String roomId;
    private String channelId;
    private String senderId;
    private String senderName;
    private String senderAvatar;
    private String type;
    private String content;
    private String fileKey;
    private String fileName;
    private Long fileSize;
    @com.fasterxml.jackson.annotation.JsonProperty("isEdited")
    private boolean isEdited;
    @com.fasterxml.jackson.annotation.JsonProperty("isPinned")
    private boolean isPinned;
    @com.fasterxml.jackson.annotation.JsonProperty("isForwarded")
    private boolean isForwarded;
    private Instant createdAt;
    private Instant updatedAt;
    private Message.ReplyTo replyTo;
    private List<ReactionResponse> reactions;
    private List<String> mentions;
    private List<String> stickerIds;

    @com.fasterxml.jackson.annotation.JsonProperty("isDeleted")
    private boolean isDeleted;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReactionResponse {
        private String emoji;
        private List<String> userIds;
        private int count;
    }

    public static MessageResponse from(Message message) {
        MessageResponseBuilder builder = MessageResponse.builder()
                .id(message.getId())
                .messageId(message.getMessageId())
                .nonce(message.getNonce())
                .roomId(message.getRoomId())
                .channelId(message.getChannelId())
                .senderId(message.getSenderId())
                .senderName(message.getSenderName())
                .senderAvatar(message.getSenderAvatar())
                .type(message.getType())
                .isEdited(message.isEdited())
                .isPinned(message.isPinned())
                .isForwarded(message.isForwarded())
                .isDeleted(message.isDeleted())
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .replyTo(message.getReplyTo());

        if (message.isDeleted()) {
            builder.content("")
                    .fileKey(null)
                    .fileName(null)
                    .fileSize(null)
                    .mentions(List.of())
                    .stickerIds(List.of())
                    .reactions(List.of());
        } else {
            builder.content(message.getContent())
                    .fileKey(message.getFileKey())
                    .fileName(message.getFileName())
                    .fileSize(message.getFileSize())
                    .mentions(message.getMentions())
                    .stickerIds(message.getStickerIds())
                    .reactions(message.getReactions() != null ? message.getReactions().stream()
                            .map(r -> ReactionResponse.builder()
                                    .emoji(r.getEmoji())
                                    .userIds(r.getUserIds() != null ? r.getUserIds() : List.of())
                                    .count(r.getUserIds() != null ? r.getUserIds().size() : 0)
                                    .build())
                            .collect(Collectors.toList()) : List.of());
        }

        return builder.build();
    }
}
