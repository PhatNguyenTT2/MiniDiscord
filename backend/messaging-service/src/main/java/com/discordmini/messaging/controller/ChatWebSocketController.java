package com.discordmini.messaging.controller;

import com.discordmini.common.event.MessageEvent;
import com.discordmini.messaging.client.MembershipClient;
import com.discordmini.messaging.model.dto.ChatMessage;
import com.discordmini.messaging.model.dto.TypingEvent;
import com.discordmini.messaging.service.MessageRouter;
import com.discordmini.messaging.service.RateLimiter;
import com.discordmini.messaging.service.RedisPubSubService;
import com.discordmini.messaging.service.AiChatbotService;
import com.discordmini.messaging.model.dto.BotCommandDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.util.List;
import java.util.ArrayList;
import org.bson.types.ObjectId;

@Slf4j
@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final RateLimiter rateLimiter;
    private final MembershipClient membershipClient;
    private final MessageRouter messageRouter;
    private final RedisPubSubService redisPubSubService;
    private final AiChatbotService aiChatbotService;

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

        // Validation: Verify stickerIds limit (max 1)
        if (message.getStickerIds() != null && message.getStickerIds().size() > 1) {
            log.warn("Message rejected: User tried to send more than 1 sticker: {}", message.getStickerIds());
            return;
        }

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

        // Extract mentions using regex <@([^>]+)>
        List<String> mentions = new ArrayList<>();
        if (message.getContent() != null) {
            Matcher matcher = Pattern.compile("<@([^>]+)>").matcher(message.getContent());
            while (matcher.find()) {
                mentions.add(matcher.group(1));
            }
        }
        message.setMentions(mentions);

        // 4. Build Event for History Service
        MessageEvent event = MessageEvent.builder()
                .id(objectId)
                .messageId(message.getMessageId())
                .nonce(message.getNonce())
                .roomId(message.getRoomId())
                .channelId(message.getChannelId())
                .senderId(userId)
                .senderName(message.getSenderName())
                .senderAvatar(message.getSenderAvatar())
                .content(message.getContent())
                .type(message.getType() != null ? message.getType() : "TEXT")
                .fileKey(message.getFileKey())
                .fileName(message.getFileName())
                .fileSize(message.getFileSize())
                .isForwarded(message.isForwarded())
                .isPinned(message.isPinned())
                .replyTo(message.getReplyTo())
                .createdAt(now)
                .mentions(mentions)
                .stickerIds(message.getStickerIds())
                .build();

        // 5. Non-blocking Publish
        messageRouter.publishToHistory(event);

        // 6. Fan-out to connected members across instances
        messageRouter.fanOutToMembers(message, message.getRoomId());

        // 7. Check if bot is mentioned in this message to execute async reply
        if (mentions != null && mentions.contains("music-bot") && message.getContent() != null) {
            String rawPrompt = message.getContent()
                    .replaceAll("<@music-bot>", "")
                    .replaceAll("@music-bot", "")
                    .trim();
            aiChatbotService.processBotMention(
                    userId,
                    message.getRoomId(),
                    message.getChannelId(),
                    rawPrompt,
                    message.getSenderName());
        }
    }

    @MessageMapping("/chat.botCommand")
    public void handleBotCommand(@Payload BotCommandDTO dto, Principal principal) {
        String userId = principal.getName();
        membershipClient.verifyMembership(userId, dto.getRoomId());
        aiChatbotService.executeSlashCommand(userId, dto.getRoomId(), dto.getChannelId(), dto.getCommand());
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
