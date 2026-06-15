package com.discordmini.groupchannel.model.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "room_bans", uniqueConstraints = {
    @UniqueConstraint(columnNames = { "room_id", "user_id" })
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomBan {

  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
  private UUID id;

  @Column(name = "room_id", nullable = false)
  private UUID roomId;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "banned_by", nullable = false)
  private UUID bannedBy;

  @Column(columnDefinition = "TEXT")
  private String reason;

  @Builder.Default
  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();
}
