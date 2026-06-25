package com.discordmini.messaging.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class ChatHistoryClient {

  private final RestClient restClient;

  public ChatHistoryClient(RestClient.Builder builder) {
    this.restClient = builder.baseUrl("lb://chat-history-service").build();
  }

  public List<Map<String, Object>> getChannelHistory(String userId, String roomId, String channelId, String after,
      int limit) {
    try {
      var response = restClient.get()
          .uri(uriBuilder -> uriBuilder
              .path("/api/messages/rooms/{roomId}/channels/{channelId}")
              .queryParam("after", after)
              .queryParam("limit", limit)
              .build(roomId, channelId))
          .header("X-User-Id", userId)
          .retrieve()
          .body(new ParameterizedTypeReference<Map<String, Object>>() {
          });

      if (response != null && response.get("data") instanceof List<?> list) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> messages = (List<Map<String, Object>>) list;
        return messages;
      }
    } catch (Exception e) {
      log.error("Failed to fetch channel history from chat-history-service: {}", e.getMessage());
    }
    return Collections.emptyList();
  }

  public Map<String, Object> getUnreadReceipt(String userId, String roomId, String channelId) {
    try {
      var response = restClient.get()
          .uri("/api/messages/rooms/{roomId}/channels/{channelId}/unread", roomId, channelId)
          .header("X-User-Id", userId)
          .retrieve()
          .body(new ParameterizedTypeReference<Map<String, Object>>() {
          });

      if (response != null && response.get("data") instanceof Map<?, ?> dataMap) {
        @SuppressWarnings("unchecked")
        Map<String, Object> receipt = (Map<String, Object>) dataMap;
        return receipt;
      }
    } catch (Exception e) {
      log.error("Failed to fetch unread receipt from chat-history-service: {}", e.getMessage());
    }
    return Collections.emptyMap();
  }
}
