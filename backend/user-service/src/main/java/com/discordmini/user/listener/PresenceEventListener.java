package com.discordmini.user.listener;

import com.discordmini.user.model.entity.Friendship;
import com.discordmini.user.model.entity.FriendshipStatus;
import com.discordmini.user.repository.FriendshipRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class PresenceEventListener {

  private final FriendshipRepository friendshipRepository;
  private final RabbitTemplate rabbitTemplate;

  @Transactional(readOnly = true)
  @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "user.presence.update.queue", durable = "true"), exchange = @Exchange(name = "user.events", type = ExchangeTypes.TOPIC), key = "user.presence.update"))
  public void handlePresenceUpdate(Map<String, String> event) {
    String userIdStr = event.get("userId");
    String status = event.get("status");

    if (userIdStr == null || status == null) {
      log.warn("Malformed presence event: {}", event);
      return;
    }

    try {
      UUID userId = UUID.fromString(userIdStr);
      List<Friendship> friendships = friendshipRepository.findByRequesterIdOrReceiverId(userId, userId)
          .stream()
          .filter(f -> f.getStatus() == FriendshipStatus.ACCEPTED)
          .toList();

      log.debug("Broadcasting presence [{}] for user {} to {} friends", status, userIdStr, friendships.size());

      for (Friendship f : friendships) {
        UUID friendId = f.getRequesterId().equals(userId) ? f.getReceiverId() : f.getRequesterId();

        try {
          rabbitTemplate.convertAndSend(
              "user.events",
              "user.friend.presence",
              Map.of(
                  "type", "PRESENCE_UPDATE",
                  "fromUserId", userIdStr,
                  "toUserId", friendId.toString(),
                  "status", status));
        } catch (Exception e) {
          log.error("Failed to publish presence for friend {}", friendId, e);
        }
      }
    } catch (Exception e) {
      // Always ACK — do not requeue
      log.error("Error processing presence event for user {}: {}", userIdStr, e.getMessage());
    }
  }
}
