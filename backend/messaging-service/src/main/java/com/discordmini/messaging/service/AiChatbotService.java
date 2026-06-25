package com.discordmini.messaging.service;

import com.discordmini.messaging.client.ChatHistoryClient;
import com.discordmini.messaging.model.dto.TypingEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiChatbotService {

  private final AiWorkerClient aiWorkerClient;
  private final BotFeedbackService botFeedbackService;
  private final RedisPubSubService redisPubSubService;
  private final ChatHistoryClient chatHistoryClient;
  private final org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

  @Async("aiTaskExecutor")
  public void processBotMention(String userId, String roomId, String channelId, String rawPrompt, String senderName) {
    try {
      log.info("Triggered async bot mention processing in room: {} channel: {} by user: {}", roomId, channelId, userId);

      // Broadcast typing event to trigger "Music Bot is thinking..." UI feedback
      TypingEvent typingEvent = TypingEvent.builder()
          .roomId(roomId)
          .channelId(channelId)
          .userId("music-bot")
          .username("music-bot")
          .build();
      redisPubSubService.publishTypingEvent(roomId, typingEvent);

      // Fetch last 20 messages of the channel for context
      List<Map<String, Object>> rawMessages = chatHistoryClient.getChannelHistory(userId, roomId, channelId, null, 20);
      List<Map<String, String>> history = new java.util.ArrayList<>();
      if (rawMessages != null) {
        for (int i = rawMessages.size() - 1; i >= 0; i--) {
          Map<String, Object> msg = rawMessages.get(i);
          Map<String, String> item = new java.util.HashMap<>();
          item.put("sender", msg.getOrDefault("senderName", "User").toString());
          item.put("content", msg.getOrDefault("content", "").toString());
          history.add(item);
        }
      }

      // Call inference client with context history
      String reply = aiWorkerClient.chat(rawPrompt, senderName, history);

      // Send response back
      botFeedbackService.sendBotFeedback(roomId, channelId, reply);

    } catch (Exception e) {
      log.error("Failed to execute AI chat mention async task", e);
    }
  }

  @Async("aiTaskExecutor")
  public void executeSlashCommand(String userId, String roomId, String channelId, String command) {
    try {
      log.info("Triggered async bot command processing: {} for user: {} in channel: {}", command, userId, channelId);

      if ("summarize".equalsIgnoreCase(command)) {
        // Fetch last 50 messages of the channel
        List<Map<String, Object>> rawMessages = chatHistoryClient.getChannelHistory(userId, roomId, channelId, null,
            50);

        if (rawMessages == null || rawMessages.isEmpty()) {
          sendPrivateSystemFeedback(userId, roomId, channelId, "⚠️ Kênh này không có tin nhắn nào để tóm tắt.");
          return;
        }

        // Format messages chronologically
        List<Map<String, String>> formattedMessages = new java.util.ArrayList<>();
        for (int i = rawMessages.size() - 1; i >= 0; i--) {
          Map<String, Object> msg = rawMessages.get(i);
          Map<String, String> item = new java.util.HashMap<>();
          item.put("sender", msg.getOrDefault("senderName", "User").toString());
          item.put("content", msg.getOrDefault("content", "").toString());
          formattedMessages.add(item);
        }

        // Call Qwen AI to summarize
        String summary = aiWorkerClient.summarize(formattedMessages);
        sendPrivateSystemFeedback(userId, roomId, channelId, summary);

      } else if ("unread".equalsIgnoreCase(command)) {
        // Fetch last read receipt
        Map<String, Object> receipt = chatHistoryClient.getUnreadReceipt(userId, roomId, channelId);
        String lastSavedMessageId = (receipt != null) ? (String) receipt.get("lastReadMessageId") : null;

        List<Map<String, Object>> rawMessages;
        if (lastSavedMessageId == null || lastSavedMessageId.trim().isEmpty()) {
          // Fallback to last 20 messages as baseline
          rawMessages = chatHistoryClient.getChannelHistory(userId, roomId, channelId, null, 20);
        } else {
          // Fetch up to 100 messages after lastReadMessageId
          rawMessages = chatHistoryClient.getChannelHistory(userId, roomId, channelId, lastSavedMessageId, 100);
        }

        if (rawMessages == null || rawMessages.isEmpty()) {
          sendPrivateSystemFeedback(userId, roomId, channelId, "✨ Bạn đã đọc hết tất cả tin nhắn trong kênh này.");
          return;
        }

        // Format messages chronologically
        List<Map<String, String>> formattedMessages = new java.util.ArrayList<>();
        for (int i = rawMessages.size() - 1; i >= 0; i--) {
          Map<String, Object> msg = rawMessages.get(i);
          Map<String, String> item = new java.util.HashMap<>();
          item.put("sender", msg.getOrDefault("senderName", "User").toString());
          item.put("content", msg.getOrDefault("content", "").toString());
          formattedMessages.add(item);
        }

        String summary = aiWorkerClient.summarize(formattedMessages);
        sendPrivateSystemFeedback(userId, roomId, channelId, summary);
      }
    } catch (Exception e) {
      log.error("Failed to execute bot slash command async task", e);
      sendPrivateSystemFeedback(userId, roomId, channelId, "⚠️ Có lỗi xảy ra trong quá trình xử lý lệnh tóm tắt.");
    }
  }

  private void sendPrivateSystemFeedback(String userId, String roomId, String channelId, String content) {
    Map<String, Object> payload = new java.util.HashMap<>();
    payload.put("type", "SYSTEM_MESSAGE_NEW");
    payload.put("messageId", java.util.UUID.randomUUID().toString());
    payload.put("roomId", roomId);
    payload.put("channelId", channelId);
    payload.put("senderId", "music-bot");
    payload.put("senderName", "Music Bot");
    payload.put("content", content);
    payload.put("createdAt", java.time.Instant.now().toString());

    try {
      messagingTemplate.convertAndSendToUser(userId, "/queue/notifications", payload);
    } catch (Exception e) {
      log.error("Failed to send private system feedback to user {}", userId, e);
    }
  }
}
