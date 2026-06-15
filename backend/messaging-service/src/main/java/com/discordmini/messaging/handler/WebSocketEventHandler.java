package com.discordmini.messaging.handler;

import com.discordmini.common.event.MessageEvent;
import com.discordmini.messaging.model.dto.ChatMessage;
import com.discordmini.messaging.model.dto.VoiceStateUpdate;
import com.discordmini.messaging.service.ConnectionManager;
import com.discordmini.messaging.service.MessageRouter;
import com.discordmini.messaging.service.PresenceService;
import com.discordmini.messaging.service.VoiceStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketEventHandler {

    private final ConnectionManager connectionManager;
    private final PresenceService presenceService;
    private final VoiceStateService voiceStateService;
    private final MessageRouter messageRouter;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal user = accessor.getUser();
        if (user != null) {
            String userId = user.getName();
            String sessionId = accessor.getSessionId();

            connectionManager.registerConnection(userId, sessionId);
            presenceService.setUserOnline(userId);
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal user = accessor.getUser();
        String userId = user != null ? user.getName() : null;

        // Fallback: read from session attributes if Principal is null
        if (userId == null) {
            Map<String, Object> attrs = accessor.getSessionAttributes();
            if (attrs != null) {
                userId = (String) attrs.get("userId");
            }
        }

        if (userId != null) {
            String sessionId = accessor.getSessionId();

            connectionManager.unregisterConnection(userId, sessionId);
            presenceService.setUserOffline(userId);

            // ── Voice State Auto-cleanup on Disconnect ──
            try {
                Map<Object, Object> voiceState = voiceStateService.getUserVoiceState(userId);
                String roomId = null;
                String channelId = null;

                if (voiceState != null && !voiceState.isEmpty()) {
                    roomId = (String) voiceState.get("roomId");
                    channelId = (String) voiceState.get("channelId");
                }

                // Secondary fallback: session attributes
                if (roomId == null || channelId == null) {
                    Map<String, Object> attrs = accessor.getSessionAttributes();
                    if (attrs != null) {
                        if (roomId == null)
                            roomId = (String) attrs.get("voiceRoomId");
                        if (channelId == null)
                            channelId = (String) attrs.get("voiceChannelId");
                    }
                }

                if (roomId != null && channelId != null) {
                    log.info("WebSocket disconnect: cleaning up user {} voice state from channel {}", userId,
                            channelId);
                    voiceStateService.leaveCurrentChannel(userId);

                    // Broadcast LEAVE update to let remaining peers close WebRTC peer connections
                    VoiceStateUpdate update = VoiceStateUpdate.builder()
                            .eventType("VOICE_STATE_UPDATE")
                            .roomId(roomId)
                            .channelId(channelId)
                            .userId(userId)
                            .action("LEAVE")
                            .build();

                    messageRouter.fanOutSystemEvent(Map.of(
                            "eventType", "VOICE_STATE_UPDATE",
                            "roomId", roomId,
                            "data", update), roomId);
                }
            } catch (Exception e) {
                log.error("Failed to clean up voice state on disconnect for user: {}", userId, e);
            }

            // ── DM Call Disconnect Teardown ──
            try {
                String roomId = voiceStateService.getActiveCallRoomForUser(userId);
                if (roomId != null) {
                    Map<Object, Object> callState = voiceStateService.getCallState(roomId);
                    if (callState != null && !callState.isEmpty()) {
                        String status = (String) callState.get("status");
                        if ("RINGING".equals(status)) {
                            log.info(
                                    "WebSocket disconnect: User {} disconnected during RINGING state in room {}. Preserving state for Redis TTL timeout.",
                                    userId, roomId);
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Failed to clean up DM call state on disconnect for user: {}", userId, e);
            }
        }
    }
}
