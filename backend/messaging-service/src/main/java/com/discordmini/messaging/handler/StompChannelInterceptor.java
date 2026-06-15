package com.discordmini.messaging.handler;

import com.discordmini.common.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.Principal;

@Component
@RequiredArgsConstructor
@Slf4j
public class StompChannelInterceptor implements ChannelInterceptor {

    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = accessor.getFirstNativeHeader("Authorization");

            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
                try {
                    String userId = jwtUtil.extractSubject(token);
                    // Optional: check if token is expired, but usually extractSubject throws
                    // exception if expired/invalid
                    if (userId != null && !jwtUtil.isTokenExpired(token)) {
                        accessor.setUser(new StompPrincipal(userId));
                        java.util.Map<String, Object> sessionAttrs = accessor.getSessionAttributes();
                        if (sessionAttrs != null) {
                            sessionAttrs.put("userId", userId);
                        }
                    } else {
                        throw new IllegalArgumentException("Invalid JWT token");
                    }
                } catch (Exception e) {
                    throw new IllegalArgumentException("Invalid JWT token", e);
                }
            } else {
                throw new IllegalArgumentException("Missing JWT token in Authorization header");
            }
        }

        if (accessor != null && StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String dest = accessor.getDestination();
            if (dest != null && dest.startsWith("/topic/room.")) {
                String roomId = dest.substring("/topic/room.".length());
                java.util.Map<String, Object> sessionAttrs = accessor.getSessionAttributes();
                if (sessionAttrs != null) {
                    sessionAttrs.put("voiceRoomId", roomId);
                }
            }
        }

        if (accessor != null && StompCommand.SEND.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();
            if (destination != null && (destination.equals("/app/chat.send")
                    || destination.equals("/app/voice.join")
                    || destination.equals("/app/voice.call"))) {
                Principal principal = accessor.getUser();
                if (principal != null) {
                    String userId = principal.getName();
                    String roomId = extractRoomIdFromPayload(message.getPayload());
                    if (roomId != null) {
                        String key = "room:mute:" + roomId + ":" + userId;
                        if (Boolean.TRUE.equals(redisTemplate.hasKey(key))) {
                            log.warn(
                                    "STOMP command SEND to destination {} rejected: User {} is currently muted in room {}",
                                    destination, userId, roomId);
                            throw new IllegalArgumentException("User is currently muted in this room");
                        }
                    }
                }
            }
        }

        return message;
    }

    private String extractRoomIdFromPayload(Object payload) {
        if (payload == null) {
            return null;
        }
        try {
            String json;
            if (payload instanceof byte[]) {
                json = new String((byte[]) payload, java.nio.charset.StandardCharsets.UTF_8);
            } else if (payload instanceof String) {
                json = (String) payload;
            } else {
                return null;
            }

            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(json);
            if (node.has("roomId")) {
                return node.get("roomId").asText();
            }
        } catch (Exception e) {
            log.warn("Failed to extract roomId from payload inside StompChannelInterceptor", e);
        }
        return null;
    }
}
