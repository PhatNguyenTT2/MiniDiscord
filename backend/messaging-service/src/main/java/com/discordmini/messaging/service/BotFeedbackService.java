package com.discordmini.messaging.service;

import com.discordmini.common.event.MessageEvent;
import com.discordmini.messaging.model.dto.ChatMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BotFeedbackService {

  private final MessageRouter messageRouter;

  public void sendBotFeedback(String roomId, String channelId, String content) {
    if (channelId == null || channelId.isEmpty()) {
      return;
    }

    MessageEvent event = MessageEvent.builder()
        .id(new org.bson.types.ObjectId().toHexString())
        .messageId(UUID.randomUUID().toString())
        .roomId(roomId)
        .channelId(channelId)
        .senderId("music-bot")
        .senderName("Music Bot")
        .senderAvatar("music-bot")
        .content(content)
        .type("USER")
        .createdAt(Instant.now())
        .build();
    try {
      messageRouter.publishToHistory(event);

      ChatMessage chatMsg = ChatMessage.builder()
          .id(event.getId())
          .messageId(event.getMessageId())
          .roomId(event.getRoomId())
          .channelId(event.getChannelId())
          .senderId(event.getSenderId())
          .senderName(event.getSenderName())
          .senderAvatar(event.getSenderAvatar())
          .content(event.getContent())
          .type(event.getType())
          .createdAt(event.getCreatedAt().toString())
          .build();
      messageRouter.fanOutToMembers(chatMsg, roomId);
    } catch (Exception e) {
      log.error("Failed to send bot chat feedback", e);
    }
  }
}
