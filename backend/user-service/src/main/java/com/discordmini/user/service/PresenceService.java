package com.discordmini.user.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PresenceService {

  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;
  private static final String PRESENCE_KEY_PREFIX = "presence:";

  public String getUserStatus(UUID userId) {
    String jsonVal = redisTemplate.opsForValue().get(PRESENCE_KEY_PREFIX + userId);
    return parseStatus(jsonVal);
  }

  public Map<UUID, String> getBulkStatus(Collection<UUID> userIds) {
    if (userIds == null || userIds.isEmpty()) {
      return new HashMap<>();
    }

    List<String> keys = userIds.stream()
        .map(id -> PRESENCE_KEY_PREFIX + id)
        .toList();

    List<String> values = redisTemplate.opsForValue().multiGet(keys);
    Map<UUID, String> statusMap = new HashMap<>();

    if (values != null) {
      int i = 0;
      for (UUID userId : userIds) {
        String jsonVal = values.get(i++);
        statusMap.put(userId, parseStatus(jsonVal));
      }
    }
    return statusMap;
  }

  private String parseStatus(String jsonVal) {
    if (jsonVal != null) {
      try {
        if (jsonVal.startsWith("{")) {
          JsonNode node = objectMapper.readTree(jsonVal);
          return node.has("status") ? node.get("status").asText() : "OFFLINE";
        }
        return jsonVal; // fallback for plain string
      } catch (Exception e) {
        log.error("Failed to parse presence JSON: {}", jsonVal, e);
      }
    }
    return "OFFLINE";
  }
}
