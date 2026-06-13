package com.discordmini.messaging.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.messaging.service.VoiceStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@RestController
@RequestMapping("/api/voice")
@RequiredArgsConstructor
public class VoiceController {

  private final VoiceStateService voiceStateService;
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

  /**
   * Expose participants list for active voice connections inside custom
   * room/channels list.
   */
  @GetMapping("/rooms/{roomId}/states")
  public ApiResponse<Map<String, Set<String>>> getVoiceStates(
      @PathVariable String roomId,
      @RequestParam List<String> channelIds) {
    log.debug("GET local voice states in room: {} paths: {}", roomId, channelIds);
    return ApiResponse.ok("Voice states loaded", voiceStateService.getAllVoiceStates(roomId, channelIds));
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
