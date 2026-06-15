package com.discordmini.groupchannel.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Role {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "room_id", nullable = false)
  private Room room;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(length = 20)
  private String color;

  @Column(nullable = false)
  @Builder.Default
  private Integer position = 0;
}
