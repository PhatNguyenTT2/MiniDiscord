package com.discordmini.common.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageEvent implements Serializable {

    private String id;
    private String messageId;
    private String nonce;
    private String roomId;
    private String channelId;
    private String senderId;
    private String senderName;
    private String senderAvatar;
    private String content;
    private String type; // TEXT, IMAGE, FILE, SYSTEM
    private String fileKey;
    private String fileName;
    private Long fileSize;
    @com.fasterxml.jackson.annotation.JsonProperty("isForwarded")
    private boolean isForwarded;
    @com.fasterxml.jackson.annotation.JsonProperty("isPinned")
    private boolean isPinned;
    private ReplyInfo replyTo;
    private Instant createdAt;
    private List<String> mentions;
    private List<String> stickerIds;
}
