package com.discordmini.messaging.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class VoiceStateService {

  private final StringRedisTemplate redisTemplate;
  private static final int MAX_PARTICIPANTS = 6;

  // ── Key Patterns ──
  // voice:channel:{roomId}:{channelId} → SET<userId> (who is in the channel)
  // voice:user:{userId} → HASH {roomId, channelId, muted, deafened} (current VC
  // of user)
  // voice:call:{roomId} → HASH {callerId, status, startedAt} (DM call transient
  // state)

  public Set<String> joinChannel(String userId, String roomId, String channelId) {
    String userKey = "voice:user:" + userId;
    String channelKey = "voice:channel:" + roomId + ":" + channelId;

    // 1. Check if already in some channel and force leave it first
    if (Boolean.TRUE.equals(redisTemplate.hasKey(userKey))) {
      log.info("User {} already in a channel, forcing leave first", userId);
      leaveCurrentChannel(userId);
    }

    // 2. Check capacity (limit to 6 people)
    Long size = redisTemplate.opsForSet().size(channelKey);
    if (size != null && size >= MAX_PARTICIPANTS) {
      log.warn("Join failed: Voice channel {} is full", channelId);
      throw new IllegalStateException("Voice channel is full (max " + MAX_PARTICIPANTS + ")");
    }

    // 3. Add to channel set
    redisTemplate.opsForSet().add(channelKey, userId);

    // 4. Track user voice state
    Map<String, String> userState = Map.of(
        "roomId", roomId,
        "channelId", channelId,
        "muted", "false",
        "deafened", "false");
    redisTemplate.opsForHash().putAll(userKey, userState);
    // Set TTL to 1 day as safe fallback, though disconnect events clean it up
    redisTemplate.expire(userKey, Duration.ofDays(1));

    log.info("User {} successfully joined voice channel: {}", userId, channelId);

    // 5. Return all other participants for WebRTC signaling target selection
    Set<String> participants = redisTemplate.opsForSet().members(channelKey);
    return participants != null ? participants : Set.of();
  }

  public void leaveCurrentChannel(String userId) {
    String userKey = "voice:user:" + userId;
    Map<Object, Object> state = redisTemplate.opsForHash().entries(userKey);
    if (state.isEmpty()) {
      return;
    }

    String roomId = (String) state.get("roomId");
    String channelId = (String) state.get("channelId");
    String channelKey = "voice:channel:" + roomId + ":" + channelId;

    // Remove from set and delete hash mapping
    redisTemplate.opsForSet().remove(channelKey, userId);
    redisTemplate.delete(userKey);

    log.info("User {} left voice channel {}", userId, channelId);

    // Cleanup empty channel keys to be tidy
    Long remaining = redisTemplate.opsForSet().size(channelKey);
    if (remaining != null && remaining == 0) {
      redisTemplate.delete(channelKey);
    }
  }

  public void updateMuteState(String userId, boolean muted, boolean deafened) {
    String userKey = "voice:user:" + userId;
    if (Boolean.TRUE.equals(redisTemplate.hasKey(userKey))) {
      redisTemplate.opsForHash().put(userKey, "muted", String.valueOf(muted));
      redisTemplate.opsForHash().put(userKey, "deafened", String.valueOf(deafened));
      log.debug("Updated mute state for user {}: muted={}, deafened={}", userId, muted, deafened);
    }
  }

  public Set<String> getChannelParticipants(String roomId, String channelId) {
    return redisTemplate.opsForSet().members("voice:channel:" + roomId + ":" + channelId);
  }

  /**
   * Get all active voice state mappings inside a server.
   * Helpful for populating room members in voice channels on page refresh.
   */
  public Map<String, Set<String>> getAllVoiceStates(String roomId, List<String> channelIds) {
    Map<String, Set<String>> result = new HashMap<>();
    if (channelIds == null)
      return result;

    for (String chId : channelIds) {
      Set<String> members = getChannelParticipants(roomId, chId);
      if (members != null && !members.isEmpty()) {
        result.put(chId, members);
      }
    }
    return result;
  }

  public Map<Object, Object> getUserVoiceState(String userId) {
    return redisTemplate.opsForHash().entries("voice:user:" + userId);
  }

  // ── Transient DM Call State Management ──

  public void setCallState(String roomId, String callerId, String status) {
    String key = "voice:call:" + roomId;
    redisTemplate.opsForHash().putAll(key, Map.of(
        "callerId", callerId,
        "status", status,
        "startedAt", String.valueOf(System.currentTimeMillis())));
    // Auto expire in 60s if the callee does not accept or decline
    redisTemplate.expire(key, Duration.ofSeconds(60));
    log.info("DM Call state created for room: {} caller: {} status: {}", roomId, callerId, status);
  }

  public void clearCallState(String roomId) {
    redisTemplate.delete("voice:call:" + roomId);
    log.info("DM Call state cleared for room: {}", roomId);
  }

  /**
   * Transition call from RINGING to ACTIVE, refreshing startedAt to the moment
   * the callee accepts (for accurate duration calculation on end).
   */
  public void setActiveCallState(String roomId) {
    String key = "voice:call:" + roomId;
    redisTemplate.opsForHash().put(key, "status", "ACTIVE");
    redisTemplate.opsForHash().put(key, "startedAt", String.valueOf(System.currentTimeMillis()));
    redisTemplate.expire(key, Duration.ofDays(1));
    log.info("DM Call state transitioned to ACTIVE for room: {}", roomId);
  }

  public Map<Object, Object> getCallState(String roomId) {
    return redisTemplate.opsForHash().entries("voice:call:" + roomId);
  }
}
