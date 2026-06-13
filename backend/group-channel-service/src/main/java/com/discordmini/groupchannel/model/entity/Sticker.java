package com.discordmini.groupchannel.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "stickers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sticker {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "pack_id", nullable = false)
  @JsonIgnore
  private StickerPack pack;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(name = "file_key", nullable = false, length = 512)
  private String fileKey;

  @Column(name = "format_type", nullable = false, length = 20)
  private String formatType; // PNG, APNG, WEBP
}
