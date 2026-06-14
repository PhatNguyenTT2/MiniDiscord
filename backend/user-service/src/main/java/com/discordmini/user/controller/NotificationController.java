package com.discordmini.user.controller;

import com.discordmini.user.model.entity.Notification;
import com.discordmini.user.repository.NotificationRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/users/notifications")
@RequiredArgsConstructor
public class NotificationController {

  private final NotificationRepository notificationRepository;

  @GetMapping
  public ResponseEntity<List<Notification>> getNotifications(Authentication authentication) {
    UUID userId = extractUserId(authentication);
    log.info("Fetching notifications for user: {}", userId);
    return ResponseEntity.ok(notificationRepository.findByUserIdOrderByCreatedAtDesc(userId));
  }

  @PostMapping("/{id}/read")
  public ResponseEntity<Void> markAsRead(
      Authentication authentication,
      @PathVariable UUID id) {
    UUID userId = extractUserId(authentication);
    log.info("Marking notification {} as read for user: {}", id, userId);

    Notification notification = notificationRepository.findById(id).orElse(null);
    if (notification != null && notification.getUserId().equals(userId)) {
      notification.setRead(true);
      notificationRepository.save(notification);
      return ResponseEntity.ok().build();
    }

    return ResponseEntity.notFound().build();
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> deleteNotification(
      Authentication authentication,
      @PathVariable UUID id) {
    UUID userId = extractUserId(authentication);
    log.info("Deleting notification {} for user: {}", id, userId);

    Notification notification = notificationRepository.findById(id).orElse(null);
    if (notification != null && notification.getUserId().equals(userId)) {
      notificationRepository.delete(notification);
      return ResponseEntity.ok().build();
    }

    return ResponseEntity.notFound().build();
  }

  @PostMapping("/clear-channel")
  public ResponseEntity<Void> clearChannel(
      Authentication authentication,
      @RequestParam(required = false) UUID roomId,
      @RequestParam(required = false) UUID channelId,
      @RequestBody(required = false) ClearChannelRequest requestBody) {

    UUID userId = extractUserId(authentication);

    UUID rId = roomId;
    UUID cId = channelId;

    if (requestBody != null) {
      if (rId == null && requestBody.getRoomId() != null) {
        try {
          rId = UUID.fromString(requestBody.getRoomId());
        } catch (Exception ignored) {
        }
      }
      if (cId == null && requestBody.getChannelId() != null) {
        try {
          cId = UUID.fromString(requestBody.getChannelId());
        } catch (Exception ignored) {
        }
      }
    }

    log.info("Clearing notification channel: userId={}, roomId={}, channelId={}", userId, rId, cId);

    List<Notification> targets;
    if (cId != null) {
      targets = notificationRepository.findByUserIdAndChannelIdAndIsReadFalse(userId, cId);
    } else if (rId != null) {
      targets = notificationRepository.findByUserIdAndRoomIdAndIsReadFalse(userId, rId);
    } else {
      return ResponseEntity.badRequest().build();
    }

    if (!targets.isEmpty()) {
      for (Notification n : targets) {
        n.setRead(true);
      }
      notificationRepository.saveAll(targets);
      log.info("Cleared {} notifications", targets.size());
    }

    return ResponseEntity.ok().build();
  }

  private UUID extractUserId(Authentication authentication) {
    return UUID.fromString(authentication.getName());
  }

  @Data
  public static class ClearChannelRequest {
    private String roomId;
    private String channelId;
  }
}
