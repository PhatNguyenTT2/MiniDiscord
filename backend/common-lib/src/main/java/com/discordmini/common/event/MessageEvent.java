package com.discordmini.common.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageEvent implements Serializable {

    private String id;
    private String messageId;
    private String roomId;
    private String channelId;
    private String senderId;
    private String senderName;
    private String senderAvatar;
    private String content;
    private String type; // TEXT, IMAGE, FILE, SYSTEM
    private String fileUrl;
    private String fileName;
    private Long fileSize;
    private ReplyInfo replyTo;
    private Instant createdAt;
}
