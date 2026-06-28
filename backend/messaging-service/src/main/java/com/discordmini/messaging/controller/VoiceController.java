package com.discordmini.messaging.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.messaging.service.VoiceStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.ArrayList;
import java.util.HashMap;

@Slf4j
@RestController
@RequestMapping("/api/voice")
@RequiredArgsConstructor
public class VoiceController {

  private final VoiceStateService voiceStateService;
  private final com.discordmini.messaging.service.MusicQueueService musicQueueService;
  private final RestTemplate restTemplate = new RestTemplate();

  @Value("${voice.metered.domain:}")
  private String meteredDomain;

  @Value("${voice.metered.secret-key:}")
  private String meteredSecretKey;

  /**
   * Endpoint to fetch dynamically generated STUN/TURN servers credentials from
   * Metered.ca.
   * Fallbacks to Google's public STUN server if the API call fails or configs are
   * empty.
   */
  @GetMapping("/ice-servers")
  public Object getIceServers() {
    if (meteredDomain != null && !meteredDomain.isEmpty()
        && meteredSecretKey != null && !meteredSecretKey.isEmpty()) {
      try {
        String meteredApiUrl = "https://" + meteredDomain + "/api/v1/turn/credentials?apiKey=" + meteredSecretKey;
        log.info("Fetching ICE dynamic servers from Metered.ca API: https://{}/api/...", meteredDomain);
        // Metered.ca returns an array of JSON objects matching standard RTCIceServer
        // values
        return restTemplate.getForObject(meteredApiUrl, Object.class);
      } catch (Exception e) {
        log.warn("Failed to retrieve dynamic ICE servers from Metered.ca, falling back to Google STUN. Error: {}",
            e.getMessage());
      }
    } else {
      log.trace("Metered.ca domain or secret-key is empty, using Google STUN fallback.");
    }
    // Fallback: Google free STUN server (useful for public network P2P test)
    return List.of(Map.of("urls", "stun:stun.l.google.com:19302"));
  }

  @GetMapping("/rooms/{roomId}/music")
  public ApiResponse<Map<String, Object>> getMusicState(@PathVariable String roomId) {
    log.info("GET music state for room: {}", roomId);
    return ApiResponse.ok("Music state loaded", musicQueueService.getState(roomId));
  }

  /**
   * Expose participants list for active voice connections inside custom
   * room/channels list.
   */
  @GetMapping("/rooms/{roomId}/states")
  public ApiResponse<Map<String, List<Map<String, Object>>>> getVoiceStates(
      @PathVariable String roomId,
      @RequestParam List<String> channelIds) {
    log.debug("GET local voice states in room: {} paths: {}", roomId, channelIds);
    Map<String, List<Map<String, Object>>> states = voiceStateService.getDetailedVoiceStates(roomId, channelIds);

    // Inject phantom music-bot into response participants list if active in room
    Map<String, Object> musicState = musicQueueService.getState(roomId);
    if (musicState != null && Boolean.TRUE.equals(musicState.get("isBotActive"))) {
      for (String chId : channelIds) {
        List<Map<String, Object>> participants = states.get(chId);
        if (participants != null && !participants.isEmpty()) {
          Map<String, Object> musicBotState = Map.of(
              "userId", "music-bot",
              "muted", false,
              "deafened", false,
              "cameraOn", false);
          List<Map<String, Object>> mutableParticipants = new ArrayList<>(participants);
          mutableParticipants.add(musicBotState);
          states.put(chId, mutableParticipants);
          break;
        }
      }
    }
    return ApiResponse.ok("Voice states loaded", states);
  }

  @GetMapping("/rooms/{roomId}/states/dm")
  public ApiResponse<List<Map<String, Object>>> getDmVoiceStates(
      @PathVariable String roomId,
      @RequestParam List<String> userIds) {
    log.info("GET DM voice states in room: {} users: {}", roomId, userIds);
    List<Map<String, Object>> states = new ArrayList<>();
    for (String uid : userIds) {
      Map<Object, Object> rawState = voiceStateService.getUserVoiceState(uid);
      if (rawState != null && !rawState.isEmpty()) {
        Map<String, Object> stateMap = new HashMap<>();
        stateMap.put("userId", uid);
        stateMap.put("muted", Boolean.parseBoolean((String) rawState.getOrDefault("muted", "false")));
        stateMap.put("deafened", Boolean.parseBoolean((String) rawState.getOrDefault("deafened", "false")));
        stateMap.put("cameraOn", Boolean.parseBoolean((String) rawState.getOrDefault("cameraOn", "false")));
        states.add(stateMap);
      }
    }
    return ApiResponse.ok("DM Voice states retrieved", states);
  }

  /**
   * Check if the authenticated user has an active incoming or outgoing transient
   * call.
   */
  @GetMapping("/active-call")
  public ApiResponse<Map<Object, Object>> getActiveCall(@RequestHeader("X-User-Id") String userId) {
    log.info("Checking active call for user ID: {}", userId);
    String roomId = voiceStateService.getActiveCallRoomForUser(userId);
    if (roomId != null) {
      Map<Object, Object> callState = voiceStateService.getCallState(roomId);
      if (callState != null && !callState.isEmpty()) {
        callState.put("roomId", roomId);
        return ApiResponse.ok("Active call found", callState);
      }
    }
    return ApiResponse.ok("No active call found", null);
  }
}
