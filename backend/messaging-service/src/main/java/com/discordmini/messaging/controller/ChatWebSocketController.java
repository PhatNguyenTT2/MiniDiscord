package com.discordmini.messaging.controller;

import com.discordmini.common.event.MessageEvent;
import com.discordmini.messaging.client.MembershipClient;
import com.discordmini.messaging.model.dto.ChatMessage;
import com.discordmini.messaging.model.dto.TypingEvent;
import com.discordmini.messaging.service.MessageRouter;
import com.discordmini.messaging.service.RateLimiter;
import com.discordmini.messaging.service.RedisPubSubService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.UUID;
import org.bson.types.ObjectId;

@Slf4j
@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final RateLimiter rateLimiter;
    private final MembershipClient membershipClient;
    private final MessageRouter messageRouter;
    private final RedisPubSubService redisPubSubService;

    @MessageMapping("/chat.send")
    public void sendChat(ChatMessage message, Principal principal) {
        String userId = principal.getName();

        // 1. Rate Limiting Check
        if (!rateLimiter.isAllowed(userId)) {
            log.warn("Rate limit exceeded for user: {}", userId);
            // Ignore or send an error back to the user via their private queue
            return;
        }

        // 2. Membership Check
        membershipClient.verifyMembership(userId, message.getRoomId());

        // 3. Populate server-controlled fields
        message.setMessageId(UUID.randomUUID().toString());
        message.setSenderId(userId);

        // Pre-generate ObjectId for consistent ID across save + broadcast
        String objectId = new ObjectId().toHexString();
        Instant now = Instant.now();
        message.setId(objectId);
        message.setCreatedAt(now.toString());

        // Note: For a production app, senderName and senderAvatar should be fetched
        // from the User service or a local cache.
        // For now, we assume we either have them or they are fetched.
        // We will leave them null or set placeholder if client didn't send.
        if (message.getSenderName() == null) {
            message.setSenderName("User-" + userId.substring(0, 4));
        }

        // 4. Build Event for History Service
        MessageEvent event = MessageEvent.builder()
                .id(objectId)
                .messageId(message.getMessageId())
                .roomId(message.getRoomId())
                .channelId(message.getChannelId())
                .senderId(userId)
                .senderName(message.getSenderName())
                .senderAvatar(message.getSenderAvatar())
                .content(message.getContent())
                .type(message.getType() != null ? message.getType() : "TEXT")
                .fileUrl(message.getFileUrl())
                .fileName(message.getFileName())
                .fileSize(message.getFileSize())
                .replyTo(message.getReplyTo())
                .createdAt(now)
                .build();

        // 5. Non-blocking Publish
        messageRouter.publishToHistory(event);

        // 6. Fan-out to connected members across instances
        messageRouter.fanOutToMembers(message, message.getRoomId());
    }

    @MessageMapping("/chat.typing")
    public void sendTyping(TypingEvent event, Principal principal) {
        String userId = principal.getName();

        // Populate server fields
        event.setUserId(userId);
        if (event.getUsername() == null) {
            event.setUsername("User-" + userId.substring(0, 4));
        }

        // Membership check (optional for typing, but good for security)
        membershipClient.verifyMembership(userId, event.getRoomId());

        // Broadcast via Redis Pub/Sub
        redisPubSubService.publishTypingEvent(event.getRoomId(), event);
    }
}
