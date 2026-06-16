package com.discordmini.messaging.listener;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class MemberEventListener {

    private final StringRedisTemplate redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "messaging.room-events.queue", durable = "true"), exchange = @Exchange(name = "room.events", type = ExchangeTypes.TOPIC), key = {
            "member.removed", "member.left" }))
    public void onMemberRemoved(Map<String, Object> event) {
        String roomId = (String) event.get("roomId");
        if (roomId != null) {
            log.info("Member removed/left event received for room {}, evicting cache", roomId);
            redisTemplate.delete("room:members:" + roomId);

            // Broadcast the MEMBER_LEFT event to the room subscribers
            try {
                String userId = (String) event.get("userId");
                messagingTemplate.convertAndSend("/topic/room." + roomId, Map.of(
                        "eventType", "MEMBER_LEFT",
                        "roomId", roomId,
                        "userId", userId != null ? userId : ""));
                log.info("Broadcasted MEMBER_LEFT event to room {} for user {}", roomId, userId);
            } catch (Exception e) {
                log.error("Failed to broadcast MEMBER_LEFT event to room {}", roomId, e);
            }
        }
    }

    @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "messaging.room-mute-events.queue", durable = "true"), exchange = @Exchange(name = "room.events", type = ExchangeTypes.TOPIC), key = {
            "member.muted" }))
    public void onMemberMuted(Map<String, Object> event) {
        String roomId = (String) event.get("roomId");
        String userId = (String) event.get("userId");
        Number durationMinutes = (Number) event.get("durationMinutes");

        if (roomId != null && userId != null && durationMinutes != null) {
            String key = "room:mute:" + roomId + ":" + userId;
            log.info("Member muted event received for room {} and user {}, caching in Redis for {} minutes",
                    roomId, userId, durationMinutes);

            String mutedUntilStr = java.time.Instant.now()
                    .plus(java.time.Duration.ofMinutes(durationMinutes.longValue())).toString();
            redisTemplate.opsForValue().set(
                    key,
                    mutedUntilStr,
                    java.time.Duration.ofMinutes(durationMinutes.longValue()));

            // Broadcast the MEMBER_MUTED event to the room subscribers
            try {
                messagingTemplate.convertAndSend("/topic/room." + roomId, Map.of(
                        "eventType", "MEMBER_MUTED",
                        "roomId", roomId,
                        "userId", userId,
                        "mutedUntil", mutedUntilStr));
                log.info("Broadcasted MEMBER_MUTED event to room {}", roomId);
            } catch (Exception e) {
                log.error("Failed to broadcast MEMBER_MUTED event to room {}", roomId, e);
            }
        }
    }

    @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "messaging.room-banned-events.queue", durable = "true"), exchange = @Exchange(name = "room.events", type = ExchangeTypes.TOPIC), key = {
            "member.banned" }))
    public void onMemberBanned(Map<String, Object> event) {
        String roomId = (String) event.get("roomId");
        String userId = (String) event.get("userId");

        if (roomId != null && userId != null) {
            log.info("Member banned event received for room {} and user {}, evicting cache", roomId, userId);
            redisTemplate.delete("room:members:" + roomId);

            // Broadcast the MEMBER_BANNED event to the room subscribers
            try {
                messagingTemplate.convertAndSend("/topic/room." + roomId, Map.of(
                        "eventType", "MEMBER_BANNED",
                        "roomId", roomId,
                        "userId", userId));
                log.info("Broadcasted MEMBER_BANNED event to room {}", roomId);
            } catch (Exception e) {
                log.error("Failed to broadcast MEMBER_BANNED event to room {}", roomId, e);
            }
        }
    }

    @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "messaging.room-presence-events.queue", durable = "true"), exchange = @Exchange(name = "room.events", type = ExchangeTypes.TOPIC), key = {
            "member.presence" }))
    public void onMemberPresence(Map<String, Object> event) {
        String roomId = (String) event.get("roomId");
        String userId = (String) event.get("userId");
        String status = (String) event.get("status");

        if (roomId != null && userId != null && status != null) {
            try {
                messagingTemplate.convertAndSend("/topic/room." + roomId, Map.of(
                        "eventType", "PRESENCE_UPDATE",
                        "roomId", roomId,
                        "fromUserId", userId,
                        "status", status));
                log.info("Broadcasted PRESENCE_UPDATE event to room {} for user {}", roomId, userId);
            } catch (Exception e) {
                log.error("Failed to broadcast PRESENCE_UPDATE event to room {}", roomId, e);
            }
        }
    }
}
