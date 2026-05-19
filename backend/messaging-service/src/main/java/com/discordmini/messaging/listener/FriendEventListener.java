package com.discordmini.messaging.listener;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Listens for friend events from user-service (via RabbitMQ)
 * and pushes notifications to the target user via STOMP WebSocket.
 *
 * Flow: user-service → RabbitMQ (user.events / user.friend.*) → this listener →
 * STOMP /user/{userId}/queue/notifications
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FriendEventListener {

    private final SimpMessagingTemplate messagingTemplate;

    @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "messaging.friend-events.queue", durable = "true"), exchange = @Exchange(name = "user.events", type = ExchangeTypes.TOPIC), key = "user.friend.*"))
    public void handleFriendEvent(Map<String, Object> event) {
        String type = (String) event.get("type");
        String toUserId = (String) event.get("toUserId");
        String fromUserId = (String) event.get("fromUserId");

        if (type == null || toUserId == null) {
            log.warn("Received malformed friend event: {}", event);
            return;
        }

        if ("PRESENCE_UPDATE".equals(type)) {
            log.info("[PRESENCE-HOP3] Presence event: from={} to={} status={}", fromUserId, toUserId,
                    event.get("status"));
        } else {
            log.info("Friend event [{}]: from={} to={}", type, fromUserId, toUserId);
        }

        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", type);
            payload.put("fromUserId", fromUserId != null ? fromUserId : "");
            if (event.containsKey("status")) {
                payload.put("status", event.get("status"));
            }

            messagingTemplate.convertAndSendToUser(
                    toUserId,
                    "/queue/notifications",
                    payload);
        } catch (Exception e) {
            // Swallow error so RabbitMQ ACKs the message (no infinite requeue)
            log.debug("Could not deliver to user {}: {}", toUserId, e.getMessage());
        }
    }
}
