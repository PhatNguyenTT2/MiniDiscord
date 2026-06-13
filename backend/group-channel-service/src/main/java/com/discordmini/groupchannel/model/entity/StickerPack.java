package com.discordmini.groupchannel.model.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "sticker_packs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StickerPack {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(name = "cover_file_key", nullable = false, length = 512)
  private String coverFileKey;

  @OneToMany(mappedBy = "pack", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
  private List<Sticker> stickers;

  @CreationTimestamp
  @Column(name = "created_at", updatable = false)
  private LocalDateTime createdAt;
}
