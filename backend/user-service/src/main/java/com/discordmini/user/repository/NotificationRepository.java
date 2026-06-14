package com.discordmini.user.repository;

import com.discordmini.user.model.entity.Notification;
import com.discordmini.user.model.entity.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

  List<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId);

  List<Notification> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(UUID userId);

  Optional<Notification> findFirstByUserIdAndTypeAndSenderIdAndRoomIdAndIsReadFalse(
      UUID userId, NotificationType type, UUID senderId, UUID roomId);

  List<Notification> findByUserIdAndRoomIdAndIsReadFalse(UUID userId, UUID roomId);

  List<Notification> findByUserIdAndChannelIdAndIsReadFalse(UUID userId, UUID channelId);
}
