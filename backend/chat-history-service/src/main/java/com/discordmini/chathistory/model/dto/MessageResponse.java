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
    private String roomId;
    private String channelId;
    private String senderId;
    private String senderName;
    private String senderAvatar;
    private String type;
    private String content;
    private String fileUrl;
    private String fileName;
    private Long fileSize;
    private boolean isEdited;
    private Instant createdAt;
    private Instant updatedAt;
    private Message.ReplyTo replyTo;
    private List<ReactionResponse> reactions;

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
        return MessageResponse.builder()
                .id(message.getId())
                .messageId(message.getMessageId())
                .roomId(message.getRoomId())
                .channelId(message.getChannelId())
                .senderId(message.getSenderId())
                .senderName(message.getSenderName())
                .senderAvatar(message.getSenderAvatar())
                .type(message.getType())
                .content(message.getContent())
                .fileUrl(message.getFileUrl())
                .fileName(message.getFileName())
                .fileSize(message.getFileSize())
                .isEdited(message.isEdited())
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .replyTo(message.getReplyTo())
                .reactions(message.getReactions() != null ? message.getReactions().stream()
                        .map(r -> ReactionResponse.builder()
                                .emoji(r.getEmoji())
                                .userIds(r.getUserIds() != null ? r.getUserIds() : List.of())
                                .count(r.getUserIds() != null ? r.getUserIds().size() : 0)
                                .build())
                        .collect(Collectors.toList()) : List.of())
                .build();
    }
}
