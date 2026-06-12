package com.discordmini.messaging.controller;

import com.discordmini.common.event.MessageEvent;
import com.discordmini.messaging.client.MembershipClient;
import com.discordmini.messaging.model.dto.*;
import com.discordmini.messaging.service.MessageRouter;
import com.discordmini.messaging.service.VoiceStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.*;

@Slf4j
@Controller
@RequiredArgsConstructor
public class VoiceWebSocketController {

  private final VoiceStateService voiceStateService;
  private final MembershipClient membershipClient;
  private final MessageRouter messageRouter;
  private final SimpMessagingTemplate messagingTemplate;

  @MessageMapping("/voice.join")
  public void joinVoice(@Payload VoiceJoinRequest request, Principal principal) {
    String userId = principal.getName();
    membershipClient.verifyMembership(userId, request.getRoomId());

    Set<String> participants = voiceStateService.joinChannel(
        userId, request.getRoomId(), request.getChannelId());

    // Broadcast state update to room members
    VoiceStateUpdate update = VoiceStateUpdate.builder()
        .eventType("VOICE_STATE_UPDATE")
        .roomId(request.getRoomId())
        .channelId(request.getChannelId())
        .userId(userId)
        .action("JOIN")
        .build();

    messageRouter.fanOutSystemEvent(Map.of(
        "eventType", "VOICE_STATE_UPDATE",
        "data", update), request.getRoomId());

    // Send existing participants list back to the joiner
    // so they know whom to create ICE offers for
    Set<String> peers = new HashSet<>(participants);
    peers.remove(userId); // Don't include self

    messagingTemplate.convertAndSendToUser(
        userId, "/queue/voice",
        Map.of(
            "type", "VOICE_PEERS",
            "peers", peers,
            "roomId", request.getRoomId(),
            "channelId", request.getChannelId()));
    log.info("User {} joined voice in room {}, channel {}. Broadcast & peers list sent.",
        userId, request.getRoomId(), request.getChannelId());
  }

  @MessageMapping("/voice.leave")
  public void leaveVoice(@Payload VoiceJoinRequest request, Principal principal) {
    String userId = principal.getName();
    voiceStateService.leaveCurrentChannel(userId);

    VoiceStateUpdate update = VoiceStateUpdate.builder()
        .eventType("VOICE_STATE_UPDATE")
        .roomId(request.getRoomId())
        .channelId(request.getChannelId())
        .userId(userId)
        .action("LEAVE")
        .build();

    messageRouter.fanOutSystemEvent(Map.of(
        "eventType", "VOICE_STATE_UPDATE",
        "data", update), request.getRoomId());
    log.info("User {} left voice in room {}, channel {}. Broadcast sent.",
        userId, request.getRoomId(), request.getChannelId());
  }

  @MessageMapping("/voice.signal")
  public void relaySignal(@Payload VoiceSignalMessage signal, Principal principal) {
    String fromUserId = principal.getName();
    // Relay signaling directly to target user's personal queue
    messagingTemplate.convertAndSendToUser(
        signal.getTargetUserId(), "/queue/voice",
        Map.of(
            "type", "SIGNAL_" + signal.getType().toUpperCase(),
            "fromUserId", fromUserId,
            "payload", signal.getPayload(),
            "roomId", signal.getRoomId(),
            "channelId", signal.getChannelId()));
    log.debug("Relayed WebRTC signaling ({}) from user {} to user {}",
        signal.getType(), fromUserId, signal.getTargetUserId());
  }

  @MessageMapping("/voice.mute")
  public void toggleMute(@Payload Map<String, Object> payload, Principal principal) {
    String userId = principal.getName();
    boolean muted = (boolean) payload.getOrDefault("muted", false);
    boolean deafened = (boolean) payload.getOrDefault("deafened", false);
    String roomId = (String) payload.get("roomId");
    String channelId = (String) payload.get("channelId");

    voiceStateService.updateMuteState(userId, muted, deafened);

    String action = deafened ? "DEAFEN" : muted ? "MUTE" : "UNMUTE";

    VoiceStateUpdate update = VoiceStateUpdate.builder()
        .eventType("VOICE_STATE_UPDATE")
        .roomId(roomId)
        .channelId(channelId)
        .userId(userId)
        .action(action)
        .build();

    messageRouter.fanOutSystemEvent(Map.of(
        "eventType", "VOICE_STATE_UPDATE",
        "data", update), roomId);
    log.info("User {} state updated to action: {}", userId, action);
  }

  // ── Transient DM Call Endpoints ──
  @MessageMapping("/voice.call")
  public void initiateCall(@Payload VoiceCallEvent event, Principal principal) {
    String callerId = principal.getName();
    voiceStateService.setCallState(event.getRoomId(), callerId, "RINGING");

    messagingTemplate.convertAndSendToUser(
        event.getTargetUserId(), "/queue/voice",
        VoiceCallEvent.builder()
            .eventType("VOICE_CALL")
            .roomId(event.getRoomId())
            .callerId(callerId)
            .callerName(event.getCallerName())
            .callerAvatar(event.getCallerAvatar())
            .action("RING")
            .build());
    log.info("DM call initiated from caller {} to target target user {}", callerId, event.getTargetUserId());
  }

  @MessageMapping("/voice.accept")
  public void acceptCall(@Payload Map<String, String> payload, Principal principal) {
    String roomId = payload.get("roomId");
    Map<Object, Object> callState = voiceStateService.getCallState(roomId);
    if (callState == null || callState.isEmpty()) {
      log.warn("Accept call failed: state not found or expired for room {}", roomId);
      return;
    }

    String callerId = (String) callState.get("callerId");

    // Transition to ACTIVE (preserves startedAt for duration calc in endCall)
    voiceStateService.setActiveCallState(roomId);

    messagingTemplate.convertAndSendToUser(
        callerId, "/queue/voice",
        Map.of(
            "type", "CALL_ACCEPTED",
            "roomId", roomId,
            "acceptedBy", principal.getName()));

    // Write system log: Call started
    MessageEvent startLog = MessageEvent.builder()
        .id(new ObjectId().toHexString())
        .messageId(UUID.randomUUID().toString())
        .roomId(roomId)
        .senderId(callerId)
        .content("voice.callStarted")
        .type("SYSTEM")
        .createdAt(Instant.now())
        .build();
    messageRouter.publishToHistory(startLog);

    log.info("DM call accepted for room {}, signaling sent to caller {}", roomId, callerId);
  }

  @MessageMapping("/voice.decline")
  public void declineCall(@Payload Map<String, String> payload, Principal principal) {
    String roomId = payload.get("roomId");
    Map<Object, Object> callState = voiceStateService.getCallState(roomId);
    if (callState == null || callState.isEmpty()) {
      log.warn("Decline call failed: state not found for room {}", roomId);
      return;
    }

    String callerId = (String) callState.get("callerId");

    // Write system log: Missed call
    MessageEvent missedLog = MessageEvent.builder()
        .id(new ObjectId().toHexString())
        .messageId(UUID.randomUUID().toString())
        .roomId(roomId)
        .senderId(callerId)
        .content("voice.callMissed")
        .type("SYSTEM")
        .createdAt(Instant.now())
        .build();
    messageRouter.publishToHistory(missedLog);

    voiceStateService.clearCallState(roomId);

    messagingTemplate.convertAndSendToUser(
        callerId, "/queue/voice",
        Map.of(
            "type", "CALL_DECLINED",
            "roomId", roomId));
    log.info("DM call declined for room {}, signaling sent to caller {}", roomId, callerId);
  }

  @MessageMapping("/voice.end")
  public void endCall(@Payload Map<String, String> payload, Principal principal) {
    String roomId = payload.get("roomId");
    Map<Object, Object> callState = voiceStateService.getCallState(roomId);

    long startedAt = 0;
    if (callState != null && !callState.isEmpty()) {
      String startStr = (String) callState.get("startedAt");
      if (startStr != null) {
        try {
          startedAt = Long.parseLong(startStr);
        } catch (NumberFormatException e) {
          log.error("Could not parse call start duration: {}", startStr);
        }
      }
      voiceStateService.clearCallState(roomId);
    }

    long duration = startedAt > 0 ? (System.currentTimeMillis() - startedAt) / 1000 : 0;

    // Broadcast to both peers in DM room
    messageRouter.fanOutSystemEvent(Map.of(
        "eventType", "VOICE_CALL",
        "data", Map.of(
            "action", "END",
            "roomId", roomId)),
        roomId);

    // Render system log for historical logs
    MessageEvent logEvent = MessageEvent.builder()
        .id(new ObjectId().toHexString())
        .messageId(UUID.randomUUID().toString())
        .roomId(roomId)
        .senderId(principal.getName())
        .content("voice.callEndedDuration:" + duration)
        .type("SYSTEM")
        .createdAt(Instant.now())
        .build();
    messageRouter.publishToHistory(logEvent);
    log.info("DM call ended in room {} after duration: {}s", roomId, duration);
  }

  private String formatDuration(long seconds) {
    if (seconds < 60)
      return seconds + " giây";
    long mins = seconds / 60;
    long secs = seconds % 60;
    return mins + " phút " + (secs > 0 ? secs + " giây" : "");
  }
}
