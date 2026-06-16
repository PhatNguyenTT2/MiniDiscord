package com.discordmini.user.model.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private NotificationType type;

  @Column(name = "sender_id")
  private UUID senderId;

  @Column(name = "sender_name")
  private String senderName;

  @Column(name = "sender_avatar")
  private String senderAvatar;

  @Column(name = "room_id")
  private UUID roomId;

  @Column(name = "room_name")
  private String roomName;

  @Column(name = "channel_id")
  private UUID channelId;

  @Column(name = "channel_name")
  private String channelName;

  @Column(name = "content", length = 1000)
  private String content;

  @JsonProperty("isRead")
  @Column(name = "is_read", nullable = false)
  private boolean isRead;

  @JsonProperty("isProcessed")
  @Column(name = "is_processed", nullable = false)
  private boolean isProcessed = false;

  @CreationTimestamp
  @Column(name = "created_at", updatable = false)
  private LocalDateTime createdAt;
}
