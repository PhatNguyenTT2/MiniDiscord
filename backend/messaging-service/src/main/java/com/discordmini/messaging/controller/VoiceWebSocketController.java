package com.discordmini.messaging.controller;

import com.discordmini.common.event.MessageEvent;
import com.discordmini.messaging.client.MembershipClient;
import com.discordmini.messaging.model.dto.*;
import com.discordmini.messaging.service.MessageRouter;
import com.discordmini.messaging.service.VoiceStateService;
import com.discordmini.messaging.service.PresenceService;
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
  private final PresenceService presenceService;

  @MessageMapping("/voice.join")
  public void joinVoice(@Payload VoiceJoinRequest request, Principal principal,
      org.springframework.messaging.simp.SimpMessageHeaderAccessor headerAccessor) {
    String userId = principal.getName();
    membershipClient.verifyMembership(userId, request.getRoomId());

    // Bind channel to session attributes for disconnect cleanup
    Map<String, Object> sessionAttrs = headerAccessor.getSessionAttributes();
    if (sessionAttrs != null) {
      sessionAttrs.put("voiceChannelId", request.getChannelId());
      sessionAttrs.put("voiceRoomId", request.getRoomId());
    }

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
        "roomId", request.getRoomId(),
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
        "roomId", request.getRoomId(),
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
        "roomId", roomId,
        "data", update), roomId);
    log.info("User {} state updated to action: {}", userId, action);
  }

  // ── Transient DM Call Endpoints ──
  @MessageMapping("/voice.call")
  public void initiateCall(@Payload VoiceCallEvent event, Principal principal) {
    String callerId = principal.getName();
    String targetUserId = event.getTargetUserId();

    // Online presence pre-check
    if (!presenceService.isUserOnline(targetUserId)) {
      log.info("Callee {} is offline. Aborting DM call and replying to caller {}", targetUserId, callerId);
      messagingTemplate.convertAndSendToUser(
          callerId, "/queue/voice",
          VoiceCallEvent.builder()
              .eventType("VOICE_CALL")
              .roomId(event.getRoomId())
              .callerId(callerId)
              .targetUserId(targetUserId)
              .action("UNAVAILABLE")
              .build());
      return;
    }

    voiceStateService.setCallState(
        event.getRoomId(),
        event.getChannelId(),
        callerId,
        targetUserId,
        "RINGING",
        event.getCallerName(),
        event.getCallerAvatar());

    messagingTemplate.convertAndSendToUser(
        targetUserId, "/queue/voice",
        VoiceCallEvent.builder()
            .eventType("VOICE_CALL")
            .roomId(event.getRoomId())
            .channelId(event.getChannelId())
            .callerId(callerId)
            .callerName(event.getCallerName())
            .callerAvatar(event.getCallerAvatar())
            .action("RING")
            .build());
    log.info("DM call initiated from caller {} to target target user {}", callerId, targetUserId);
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
    String channelId = (String) callState.get("channelId");
    String callerName = (String) callState.get("callerName");
    String callerAvatar = (String) callState.get("callerAvatar");

    // Write system log: Missed call
    MessageEvent missedLog = MessageEvent.builder()
        .id(new ObjectId().toHexString())
        .messageId(UUID.randomUUID().toString())
        .roomId(roomId)
        .channelId(channelId)
        .senderId(callerId)
        .senderName(callerName != null ? callerName : "User")
        .senderAvatar(callerAvatar)
        .content("voice.callMissedLog")
        .type("SYSTEM")
        .createdAt(Instant.now())
        .build();
    messageRouter.publishToHistory(missedLog);

    ChatMessage chatMsg = ChatMessage.builder()
        .id(missedLog.getId())
        .messageId(missedLog.getMessageId())
        .roomId(missedLog.getRoomId())
        .channelId(missedLog.getChannelId())
        .senderId(missedLog.getSenderId())
        .senderName(missedLog.getSenderName())
        .senderAvatar(missedLog.getSenderAvatar())
        .content(missedLog.getContent())
        .type(missedLog.getType())
        .createdAt(missedLog.getCreatedAt().toString())
        .build();
    messageRouter.fanOutToMembers(chatMsg, roomId);

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
    String callerId = principal.getName();
    String channelId = null;
    String callerName = null;
    String callerAvatar = null;
    String status = null;

    if (callState != null && !callState.isEmpty()) {
      String startStr = (String) callState.get("startedAt");
      if (startStr != null) {
        try {
          startedAt = Long.parseLong(startStr);
        } catch (NumberFormatException e) {
          log.error("Could not parse call start duration: {}", startStr);
        }
      }
      String storedCallerId = (String) callState.get("callerId");
      if (storedCallerId != null) {
        callerId = storedCallerId;
      }
      channelId = (String) callState.get("channelId");
      callerName = (String) callState.get("callerName");
      callerAvatar = (String) callState.get("callerAvatar");
      status = (String) callState.get("status");
      voiceStateService.clearCallState(roomId);
    }

    // Broadcast to both peers in DM room
    messageRouter.fanOutSystemEvent(Map.of(
        "eventType", "VOICE_CALL",
        "roomId", roomId,
        "data", Map.of(
            "action", "END",
            "roomId", roomId)),
        roomId);

    // Only write system log if call state details were resolved (first end trigger)
    if (callState != null && !callState.isEmpty()) {
      boolean isRinging = "RINGING".equals(status);
      MessageEvent logEvent;

      if (isRinging) {
        logEvent = MessageEvent.builder()
            .id(new ObjectId().toHexString())
            .messageId(UUID.randomUUID().toString())
            .roomId(roomId)
            .channelId(channelId)
            .senderId(callerId)
            .senderName(callerName != null ? callerName : "User")
            .senderAvatar(callerAvatar)
            .content("voice.callMissedLog")
            .type("SYSTEM")
            .createdAt(Instant.now())
            .build();
      } else {
        long duration = startedAt > 0 ? (System.currentTimeMillis() - startedAt) / 1000 : 0;
        logEvent = MessageEvent.builder()
            .id(new ObjectId().toHexString())
            .messageId(UUID.randomUUID().toString())
            .roomId(roomId)
            .channelId(channelId)
            .senderId(callerId)
            .senderName(callerName != null ? callerName : "User")
            .senderAvatar(callerAvatar)
            .content("voice.callCompletedLog:" + duration)
            .type("SYSTEM")
            .createdAt(Instant.now())
            .build();
      }

      messageRouter.publishToHistory(logEvent);

      ChatMessage chatMsg = ChatMessage.builder()
          .id(logEvent.getId())
          .messageId(logEvent.getMessageId())
          .roomId(logEvent.getRoomId())
          .channelId(logEvent.getChannelId())
          .senderId(logEvent.getSenderId())
          .senderName(logEvent.getSenderName())
          .senderAvatar(logEvent.getSenderAvatar())
          .content(logEvent.getContent())
          .type(logEvent.getType())
          .createdAt(logEvent.getCreatedAt().toString())
          .build();
      messageRouter.fanOutToMembers(chatMsg, roomId);

      log.info("DM call ended in room {} with status: {}. System event logged.", roomId,
          isRinging ? "MISSED" : "COMPLETED");
    }
  }

  private String formatDuration(long seconds) {
    if (seconds < 60)
      return seconds + " giây";
    long mins = seconds / 60;
    long secs = seconds % 60;
    return mins + " phút " + (secs > 0 ? secs + " giây" : "");
  }
}
