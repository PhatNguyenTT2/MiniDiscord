package com.discordmini.user.listener;

import com.discordmini.common.event.MessageEvent;
import com.discordmini.user.client.GroupChannelClient;
import com.discordmini.user.model.entity.Notification;
import com.discordmini.user.model.entity.NotificationType;
import com.discordmini.user.model.entity.User;
import com.discordmini.user.model.event.FriendEvent;
import com.discordmini.user.repository.NotificationRepository;
import com.discordmini.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventListener {

  private final NotificationRepository notificationRepository;
  private final UserRepository userRepository;
  private final GroupChannelClient groupChannelClient;
  private final RabbitTemplate rabbitTemplate;

  /**
   * Listen for message.sent events to produce DM & MENTION notifications.
   */
  @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "user.notification.message.queue", durable = "true"), exchange = @Exchange(name = "chat.exchange", type = ExchangeTypes.TOPIC), key = "message.sent"))
  public void handleMessageEvent(MessageEvent event) {
    log.info("Received message.sent event: messageId={}, roomId={}", event.getMessageId(), event.getRoomId());

    if (event.getRoomId() == null || event.getSenderId() == null) {
      return;
    }

    UUID roomId = UUID.fromString(event.getRoomId());
    UUID senderId = UUID.fromString(event.getSenderId());

    boolean isDm = event.getChannelId() == null || event.getChannelId().isBlank();

    if (isDm) {
      // It's a Direct Message - Notify the OTHER participant
      List<UUID> memberIds = groupChannelClient.getRoomMemberIds(roomId);
      UUID recipientId = memberIds.stream()
          .filter(id -> !id.equals(senderId))
          .findFirst()
          .orElse(null);

      if (recipientId != null) {
        // Check if there is already an existing UNREAD DM notification from this sender
        // and room
        Optional<Notification> existingOpt = notificationRepository
            .findFirstByUserIdAndTypeAndSenderIdAndRoomIdAndIsReadFalse(
                recipientId, NotificationType.DM, senderId, roomId);

        if (existingOpt.isPresent()) {
          Notification existing = existingOpt.get();
          existing.setContent(event.getContent());
          existing.setCreatedAt(LocalDateTime.now());
          notificationRepository.save(existing);
          log.info("Debounced DM notification for recipient {}", recipientId);
        } else {
          Notification notification = Notification.builder()
              .userId(recipientId)
              .type(NotificationType.DM)
              .senderId(senderId)
              .senderName(event.getSenderName())
              .senderAvatar(event.getSenderAvatar())
              .roomId(roomId)
              .content(event.getContent())
              .isRead(false)
              .build();

          notificationRepository.save(notification);
          log.info("Created new DM notification for recipient {}", recipientId);
        }

        // Broadcast live WS Update
        broadcastWsUpdate(recipientId);
      }
    } else {
      // It's a Channel Message - Process Mentions
      if (event.getMentions() != null && !event.getMentions().isEmpty()) {
        UUID channelId = UUID.fromString(event.getChannelId());

        for (String mentionIdStr : event.getMentions()) {
          try {
            UUID recipientId = UUID.fromString(mentionIdStr);
            if (recipientId.equals(senderId)) {
              continue; // Skip self mentions
            }

            Notification notification = Notification.builder()
                .userId(recipientId)
                .type(NotificationType.MENTION)
                .senderId(senderId)
                .senderName(event.getSenderName())
                .senderAvatar(event.getSenderAvatar())
                .roomId(roomId)
                .channelId(channelId)
                .content(event.getContent())
                .isRead(false)
                .build();

            notificationRepository.save(notification);
            log.info("Created MENTION notification for recipient {}", recipientId);

            // Broadcast live WS Update
            broadcastWsUpdate(recipientId);
          } catch (Exception e) {
            log.error("Failed to process mention target ID: {}", mentionIdStr, e);
          }
        }
      }
    }
  }

  /**
   * Listen for room.member.added to produce SERVER_INVITE notifications.
   */
  @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "user.notification.room.queue", durable = "true"), exchange = @Exchange(name = "room.events", type = ExchangeTypes.TOPIC), key = "room.member.added"))
  public void handleRoomMemberAdded(Map<String, Object> event) {
    log.info("Received room.member.added event: {}", event);

    try {
      String roomIdStr = (String) event.get("roomId");
      String roomName = (String) event.get("roomName");
      String targetUserIdStr = (String) event.get("targetUserId");
      String invitedByIdStr = (String) event.get("invitedById");

      if (roomIdStr == null || targetUserIdStr == null || invitedByIdStr == null) {
        return;
      }

      UUID roomId = UUID.fromString(roomIdStr);
      UUID targetUserId = UUID.fromString(targetUserIdStr);
      UUID invitedById = UUID.fromString(invitedByIdStr);

      // Fetch inviter information to populate sender labels
      User inviter = userRepository.findById(invitedById).orElse(null);
      String inviterName = inviter != null ? (inviter.getUsername()) : "User";
      String inviterAvatar = inviter != null ? inviter.getAvatarUrl() : null;

      Notification notification = Notification.builder()
          .userId(targetUserId)
          .type(NotificationType.SERVER_INVITE)
          .senderId(invitedById)
          .senderName(inviterName)
          .senderAvatar(inviterAvatar)
          .roomId(roomId)
          .roomName(roomName)
          .isRead(false)
          .build();

      notificationRepository.save(notification);
      log.info("Created SERVER_INVITE notification for user {}", targetUserId);

      // Broadcast live WS Update
      broadcastWsUpdate(targetUserId);
    } catch (Exception e) {
      log.error("Failed to process room member added notification", e);
    }
  }

  /**
   * Listen for friend acceptance to produce FRIEND_ACCEPTED notifications.
   */
  @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "user.notification.friend.queue", durable = "true"), exchange = @Exchange(name = "user.events", type = ExchangeTypes.TOPIC), key = "user.friend.friend.accepted"))
  public void handleFriendAccepted(FriendEvent event) {
    log.info("Received friend accepted event: from={}, to={}", event.getFromUserId(), event.getToUserId());

    try {
      UUID accepterId = event.getFromUserId(); // The person accepting (notification sender)
      UUID requesterId = event.getToUserId(); // The recipient of approval notification

      User accepter = userRepository.findById(accepterId).orElse(null);
      String accepterName = accepter != null ? accepter.getUsername() : "User";
      String accepterAvatar = accepter != null ? accepter.getAvatarUrl() : null;

      Notification notification = Notification.builder()
          .userId(requesterId)
          .type(NotificationType.FRIEND_ACCEPTED)
          .senderId(accepterId)
          .senderName(accepterName)
          .senderAvatar(accepterAvatar)
          .isRead(false)
          .build();

      notificationRepository.save(notification);
      log.info("Created FRIEND_ACCEPTED notification for user {}", requesterId);

      // Broadcast live WS Update
      broadcastWsUpdate(requesterId);
    } catch (Exception e) {
      log.error("Failed to process friend accepted notification", e);
    }
  }

  private void broadcastWsUpdate(UUID recipientId) {
    try {
      rabbitTemplate.convertAndSend(
          "user.events",
          "user.friend.inbox.update",
          Map.of(
              "type", "INBOX_UPDATE",
              "toUserId", recipientId.toString()));
      log.info("Broadcasted WS update event for user {}", recipientId);
    } catch (Exception e) {
      log.error("Failed to broadcast WS inbox update for user {}", recipientId, e);
    }
  }
}
