package com.discordmini.groupchannel.model.dto;

import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InviteLinkResponse {
  private UUID id;
  private String code;
  private UUID roomId;
  private String roomName;
  private String roomIcon;
  private Integer uses;
  private Instant expiresAt;
  private Instant createdAt;
  private UUID creatorId;
}
