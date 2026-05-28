package com.discordmini.messaging.service;

import com.discordmini.messaging.model.dto.TypingEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedisPubSubService implements MessageListener {

    private final StringRedisTemplate redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;
    private final ConnectionManager connectionManager;

    public static final String TYPING_CHANNEL_PREFIX = "typing:";
    public static final String PRESENCE_CHANNEL_PREFIX = "presence:";

    // Publishing methods
    public void publishTypingEvent(String roomId, TypingEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            redisTemplate.convertAndSend(TYPING_CHANNEL_PREFIX + roomId, payload);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize typing event", e);
        }
    }

    public void publishPresenceEvent(String roomId, String userId, String status) {
        String payload = String.format("{\"userId\":\"%s\",\"status\":\"%s\"}", userId, status);
        redisTemplate.convertAndSend(PRESENCE_CHANNEL_PREFIX + roomId, payload);
    }

    // Subscribing method
    @Override
    public void onMessage(Message message, byte[] pattern) {
        String channel = new String(message.getChannel(), StandardCharsets.UTF_8);
        String body = new String(message.getBody(), StandardCharsets.UTF_8);

        if (channel.startsWith(TYPING_CHANNEL_PREFIX)) {
            String roomId = channel.substring(TYPING_CHANNEL_PREFIX.length());
            try {
                TypingEvent event = objectMapper.readValue(body, TypingEvent.class);
                // Broadcast to the main room topic
                java.util.Map<String, Object> payload = new java.util.HashMap<>();
                payload.put("eventType", "TYPING_START");
                payload.put("roomId", event.getRoomId());
                payload.put("channelId", event.getChannelId());
                payload.put("userId", event.getUserId());
                payload.put("username", event.getUsername());

                messagingTemplate.convertAndSend("/topic/room." + roomId, payload);
            } catch (Exception e) {
                log.error("Failed to parse typing event", e);
            }
        } else if (channel.startsWith(PRESENCE_CHANNEL_PREFIX)) {
            String roomId = channel.substring(PRESENCE_CHANNEL_PREFIX.length());
            messagingTemplate.convertAndSend("/topic/room." + roomId + ".presence", body);
        }
    }
}
