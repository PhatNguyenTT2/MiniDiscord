package com.discordmini.groupchannel.model.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "invite_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InviteLink {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "room_id", nullable = false)
  private Room room;

  @Column(name = "creator_id", nullable = false)
  private UUID creatorId;

  @Column(nullable = false, unique = true, length = 8)
  private String code;

  @Column(nullable = false)
  @Builder.Default
  private Integer uses = 0;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @CreationTimestamp
  @Column(name = "created_at", updatable = false)
  private Instant createdAt;
}
