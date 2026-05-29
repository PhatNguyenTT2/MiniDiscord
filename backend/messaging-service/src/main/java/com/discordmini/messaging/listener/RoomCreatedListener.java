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
 * Listens for room.created events from group-channel-service.
 * Notifies DM participants via STOMP so their frontend can auto-fetch and
 * subscribe.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RoomCreatedListener {

  private final SimpMessagingTemplate messagingTemplate;

  @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "messaging.room-created.queue", durable = "true"), exchange = @Exchange(name = "room.events", type = ExchangeTypes.TOPIC), key = "room.created"))
  public void handleRoomCreated(Map<String, Object> event) {
    String roomId = event.get("roomId") != null ? String.valueOf(event.get("roomId")) : null;
    String ownerId = event.get("ownerId") != null ? String.valueOf(event.get("ownerId")) : null;
    String targetUserId = event.get("targetUserId") != null ? String.valueOf(event.get("targetUserId")) : null;
    String type = event.get("type") != null ? String.valueOf(event.get("type")) : null;

    if (roomId == null) {
      log.warn("Received malformed room.created event: {}", event);
      return;
    }

    log.info("[ROOM_CREATED] roomId={} ownerId={} targetUserId={} type={}", roomId, ownerId, targetUserId, type);

    Map<String, Object> payload = new HashMap<>();
    payload.put("type", "ROOM_CREATED");
    payload.put("roomId", roomId);

    // Notify the target user (the OTHER participant in DM)
    if (targetUserId != null && !targetUserId.equals(ownerId)) {
      try {
        messagingTemplate.convertAndSendToUser(
            targetUserId, "/queue/notifications", payload);
        log.info("[ROOM_CREATED] Notified target user {} about new room {}", targetUserId, roomId);
      } catch (Exception e) {
        log.debug("Could not notify target user {}: {}", targetUserId, e.getMessage());
      }
    }

    // Also notify the owner (they might have multiple tabs)
    if (ownerId != null) {
      try {
        messagingTemplate.convertAndSendToUser(
            ownerId, "/queue/notifications", payload);
      } catch (Exception e) {
        log.debug("Could not notify owner {}: {}", ownerId, e.getMessage());
      }
    }
  }
}
