package com.discordmini.messaging.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.discordmini.messaging.model.dto.MusicTrack;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MusicQueueService {

  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;

  private String getQueueKey(String roomId) {
    return "room:music_queue:" + roomId;
  }

  private String getStateKey(String roomId) {
    return "room:music_state:" + roomId;
  }

  public void addToQueue(String roomId, MusicTrack track) {
    String key = getQueueKey(roomId);
    try {
      String json = objectMapper.writeValueAsString(track);
      redisTemplate.opsForList().rightPush(key, json);
      log.info("Added track {} to queue for room {}", track.getTitle(), roomId);
    } catch (Exception e) {
      log.error("Failed to add track to queue: {}", e.getMessage());
    }
  }

  public MusicTrack popNext(String roomId) {
    String key = getQueueKey(roomId);
    String json = redisTemplate.opsForList().leftPop(key);
    if (json == null) {
      return null;
    }
    try {
      return objectMapper.readValue(json, MusicTrack.class);
    } catch (Exception e) {
      log.error("Failed to parse track from queue: {}", e.getMessage());
      return null;
    }
  }

  public List<MusicTrack> getQueue(String roomId) {
    String key = getQueueKey(roomId);
    List<String> range = redisTemplate.opsForList().range(key, 0, -1);
    if (range == null) {
      return Collections.emptyList();
    }
    return range.stream().map(json -> {
      try {
        return objectMapper.readValue(json, MusicTrack.class);
      } catch (Exception e) {
        log.error("Failed to parse track from range: {}", e.getMessage());
        return null;
      }
    }).filter(Objects::nonNull).collect(Collectors.toList());
  }

  public void setPlaying(String roomId, MusicTrack track) {
    String key = getStateKey(roomId);
    try {
      Map<String, String> state = new HashMap<>();
      state.put("isBotActive", "true");
      state.put("currentTrack", objectMapper.writeValueAsString(track));
      state.put("startTime", String.valueOf(System.currentTimeMillis()));
      redisTemplate.opsForHash().putAll(key, state);
      log.info("Room {} is now playing: {}", roomId, track.getTitle());
    } catch (Exception e) {
      log.error("Failed to set playing state: {}", e.getMessage());
    }
  }

  public void clearState(String roomId) {
    redisTemplate.delete(getStateKey(roomId));
    redisTemplate.delete(getQueueKey(roomId));
    log.info("Cleared music state and queue for room {}", roomId);
  }

  public Map<String, Object> getState(String roomId) {
    String key = getStateKey(roomId);
    Map<Object, Object> entries = redisTemplate.opsForHash().entries(key);
    if (entries.isEmpty()) {
      return null;
    }
    Map<String, Object> result = new HashMap<>();
    result.put("isBotActive", Boolean.parseBoolean((String) entries.get("isBotActive")));
    result.put("startTime", Long.parseLong((String) entries.get("startTime")));

    String trackJson = (String) entries.get("currentTrack");
    if (trackJson != null) {
      try {
        result.put("currentTrack", objectMapper.readValue(trackJson, MusicTrack.class));
      } catch (Exception e) {
        log.error("Failed to parse current track from state: {}", e.getMessage());
      }
    }
    return result;
  }
}
