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

    @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "messaging.friend-events.queue", durable = "true"), exchange = @Exchange(name = "user.events", type = ExchangeTypes.TOPIC), key = "user.friend.#"))
    public void handleFriendEvent(Map<String, Object> event) {
        String type = (String) event.get("type");
        // Safe UUID→String conversion (Jackson may deserialize UUID as non-String
        // object)
        String toUserId = event.get("toUserId") != null ? String.valueOf(event.get("toUserId")) : null;
        String fromUserId = event.get("fromUserId") != null ? String.valueOf(event.get("fromUserId")) : null;

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

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("fromUserId", fromUserId != null ? fromUserId : "");
        if (event.containsKey("status")) {
            payload.put("status", event.get("status"));
        }

        // Notify the receiver (target user)
        try {
            messagingTemplate.convertAndSendToUser(
                    toUserId,
                    "/queue/notifications",
                    payload);
            log.debug("Delivered friend event [{}] to receiver {}", type, toUserId);
        } catch (Exception e) {
            log.debug("Could not deliver to receiver {}: {}", toUserId, e.getMessage());
        }

        // Notify the sender too (so their Pending list updates in real-time)
        if (fromUserId != null && !"PRESENCE_UPDATE".equals(type)) {
            try {
                messagingTemplate.convertAndSendToUser(
                        fromUserId,
                        "/queue/notifications",
                        payload);
                log.debug("Delivered friend event [{}] to sender {}", type, fromUserId);
            } catch (Exception e) {
                log.debug("Could not deliver to sender {}: {}", fromUserId, e.getMessage());
            }
        }
    }
}
